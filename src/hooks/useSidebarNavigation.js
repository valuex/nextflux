import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "@nanostores/react";
import { feedsByCategory, categoryExpandedState, updateCategoryExpandState, unreadCounts } from "@/stores/feedsStore.js";
import { settingsState } from "@/stores/settingsStore.js";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function useSidebarNavigation() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { categoryId, feedId } = useParams();
  const $feedsByCategory = useStore(feedsByCategory);
  const $categoryExpandedState = useStore(categoryExpandedState);
  const $unreadCounts = useStore(unreadCounts);
  const { defaultExpandCategory } = useStore(settingsState);

  const getAllNavigableItems = () => {
    const items = [];
    
    // 添加"所有文章"项
    items.push({ type: 'all', id: 'all', path: '/' });
    
    // 添加分组和订阅
    $feedsByCategory.forEach(category => {
      // 添加分组
      items.push({ 
        type: 'category', 
        id: category.id, 
        path: `/category/${category.id}`,
        isExpanded: $categoryExpandedState[category.id] ?? defaultExpandCategory
      });
      
      // 如果分组已展开，添加该分组下的所有订阅
      if ($categoryExpandedState[category.id]) {
        category.feeds.forEach(feed => {
          items.push({ 
            type: 'feed', 
            id: feed.id, 
            categoryId: category.id,
            path: `/feed/${feed.id}` 
          });
        });
      }
    });
    
    return items;
  };

 
  const getCurrentItemIndex = () => {
    const items = getAllNavigableItems();
    
    if (feedId) {
      return items.findIndex(item => item.type === 'feed' && item.id === parseInt(feedId));
    } else if (categoryId) {
      return items.findIndex(item => item.type === 'category' && item.id === categoryId);
    } else {
      // 默认为"所有文章"
      return 0;
    }
  };


  const navigateToPrevious = () => {
    const items = getAllNavigableItems();
    const currentIndex = getCurrentItemIndex();
    
    if (currentIndex > 0) {
      const prevItem = items[currentIndex - 1];
      navigate(prevItem.path);
    }
  };


  const navigateToNext = () => {
    const items = getAllNavigableItems();
    const currentIndex = getCurrentItemIndex();
    
    // Check if there are any unread items
    const totalUnread = Object.values($unreadCounts).reduce((sum, count) => sum + count, 0);
    if (totalUnread === 0) {
      toast.success(t("common.allHasBeenRead"));
      return;
    }
    
    let nextItem;
    
    if (currentIndex < items.length - 1) {
      let nextIndex = currentIndex + 1;
      nextItem = items[nextIndex];
      
      // Skip "All Articles" and navigate to the next feed
      if (nextItem.type === 'all') {
        // Find the next feed item
        for (let i = nextIndex + 1; i < items.length; i++) {
          if (items[i].type === 'feed') {
            nextItem = items[i];
            break;
          }
        }
      }
    } else {
      // At the last item, wrap around to the first feed
      for (let i = 0; i < items.length; i++) {
        if (items[i].type === 'feed') {
          nextItem = items[i];
          break;
        }
      }
    }
    
    if (nextItem) {
      navigate(nextItem.path);
    }
  };


  const toggleCurrentCategory = () => {
    if (categoryId) {
      const currentState = $categoryExpandedState[categoryId] ?? defaultExpandCategory;
      updateCategoryExpandState(categoryId, !currentState);
    } else if (feedId) {
      // 如果当前是订阅，找到其所属分组
      const items = getAllNavigableItems();
      const currentItem = items.find(item => item.type === 'feed' && item.id === parseInt(feedId));
      if (currentItem && currentItem.categoryId) {
        const currentState = $categoryExpandedState[currentItem.categoryId] ?? defaultExpandCategory;
        updateCategoryExpandState(currentItem.categoryId, !currentState);
        navigate(`/category/${currentItem.categoryId}`);
      }
    }
  };

  return {
    navigateToPrevious,
    navigateToNext,
    toggleCurrentCategory
  };
} 