import {
  Accordion,
  AccordionItem,
  Button,
  Checkbox,
  Input,
  Link,
  ScrollShadow,
  Select,
  SelectItem,
  Textarea,
} from "@heroui/react";
import { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { categories, feeds } from "@/stores/feedsStore";
import { editFeedModalOpen, currentFeedId } from "@/stores/modalStore";
import { useParams } from "react-router-dom";
import minifluxAPI from "@/api/miniflux";
import { forceSync } from "@/stores/syncStore";
import { Check, Copy, Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import CustomModal from "@/components/ui/CustomModal.jsx";
import { getFeedPreference, setFeedPreference } from "@/db/feedPreferences.js";

export default function EditFeedModal() {
  const { t } = useTranslation();
  const { feedId: routeFeedId } = useParams();
  const $feeds = useStore(feeds);
  const $categories = useStore(categories);
  const $editFeedModalOpen = useStore(editFeedModalOpen);
  const $currentFeedId = useStore(currentFeedId);
  // 优先使用 store 中的 feedId，如果没有则使用路由参数中的 feedId
  const feedId = $currentFeedId || routeFeedId;
  const [loading, setLoading] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category_id: "",
    hide_globally: false,
    crawler: false,
    open_articles_in_browser: false,
    keeplist_rules: "",
    blocklist_rules: "",
    rewrite_rules: "",
  });

  useEffect(() => {
    if (feedId) {
      const feed = $feeds.find((f) => f.id === parseInt(feedId));
      if (feed) {
        const localPrefs = getFeedPreference(parseInt(feedId));
        setFormData({
          title: feed.title,
          category_id: feed.categoryId,
          hide_globally: feed.hide_globally,
          crawler: feed.crawler,
          open_articles_in_browser: localPrefs.open_articles_in_browser || false,
          keeplist_rules: feed.keeplist_rules,
          blocklist_rules: feed.blocklist_rules,
          rewrite_rules: feed.rewrite_rules,
        });
        setFeedUrl(feed.url);
      }
    }
  }, [feedId, $feeds]);

  const onClose = () => {
    editFeedModalOpen.set(false);
    currentFeedId.set(null); // 清除 store 中的 feedId
    if (feedId) {
      const feed = $feeds.find((f) => f.id === parseInt(feedId));
      if (feed) {
        const localPrefs = getFeedPreference(parseInt(feedId));
        setFormData({
          title: feed.title,
          category_id: feed.categoryId,
          hide_globally: feed.hide_globally,
          crawler: feed.crawler,
          open_articles_in_browser: localPrefs.open_articles_in_browser || false,
          keeplist_rules: feed.keeplist_rules,
          blocklist_rules: feed.blocklist_rules,
          rewrite_rules: feed.rewrite_rules,
        });
        setFeedUrl(feed.url);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Save local preferences immediately (synchronous)
      setFeedPreference(parseInt(feedId), {
        open_articles_in_browser: formData.open_articles_in_browser
      });
      
      // Send only API-supported fields to Miniflux
      const apiData = {
        title: formData.title,
        category_id: formData.category_id,
        hide_globally: formData.hide_globally,
        crawler: formData.crawler,
        keeplist_rules: formData.keeplist_rules,
        blocklist_rules: formData.blocklist_rules,
        rewrite_rules: formData.rewrite_rules,
      };
      
      await minifluxAPI.updateFeed(feedId, apiData);
      // Close immediately, let sync happen in background
      onClose();
      // Sync in background without blocking UI
      forceSync();
    } catch (error) {
      console.error("更新订阅源失败:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CustomModal
      open={$editFeedModalOpen}
      onOpenChange={onClose}
      title={t("articleList.editFeed")}
    >
      <ScrollShadow size={10} className="w-full overflow-y-auto px-4 pb-4">
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <Input
            isRequired
            labelPlacement="outside"
            size="sm"
            label={t("feed.feedTitle")}
            variant="faded"
            name="title"
            placeholder={t("feed.feedTitlePlaceholder")}
            errorMessage={t("feed.feedTitleRequired")}
            value={formData.title}
            onValueChange={(value) =>
              setFormData({ ...formData, title: value })
            }
          />
          <Select
            isRequired
            labelPlacement="outside"
            size="sm"
            label={t("feed.feedCategory")}
            variant="faded"
            name="category_id"
            placeholder={t("feed.feedCategoryPlaceholder")}
            selectedKeys={[formData.category_id?.toString()]}
            onChange={(e) =>
              setFormData({
                ...formData,
                category_id: parseInt(e.target.value),
              })
            }
          >
            {$categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.title}
              </SelectItem>
            ))}
          </Select>
          <div>
            <div className="text-xs ml-0.5 mb-1">{t("feed.feedUrl")}</div>
            <div className="flex items-center gap-2 bg-content2 rounded-lg pl-3 pr-1 py-1 border-default-200 hover:border-default-400 border-2 shadow-xs transition-colors">
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="text-sm text-default-400 w-full truncate">
                  {feedUrl}
                </div>
              </div>
              <Button
                size="sm"
                className="h-5!"
                isIconOnly
                isDisabled={isCopied}
                variant="flat"
                startContent={
                  isCopied ? (
                    <Check className="size-3 shrink-0 text-default-500" />
                  ) : (
                    <Copy className="size-3 shrink-0 text-default-500" />
                  )
                }
                onPress={() => {
                  navigator.clipboard.writeText(feedUrl);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 3000);
                }}
              />
            </div>
          </div>
          <Checkbox
            name="crawler"
            size="sm"
            classNames={{
              base: "w-full max-w-full p-0 mx-0 -mt-4  mb-1",
              label: "mt-4",
            }}
            isSelected={formData.crawler}
            onValueChange={(value) =>
              setFormData({ ...formData, crawler: value })
            }
          >
            <div className="line-clamp-1">{t("feed.feedCrawler")}</div>
            <div className="text-xs text-default-400 line-clamp-1">
              {t("feed.feedCrawlerDescription")}
            </div>
          </Checkbox>
          <Checkbox
            name="hide_globally"
            size="sm"
            classNames={{
              base: "w-full max-w-full p-0 mx-0 -mt-4  mb-1",
              label: "mt-4",
            }}
            isSelected={formData.hide_globally}
            onValueChange={(value) =>
              setFormData({ ...formData, hide_globally: value })
            }
          >
            <div className="line-clamp-1">{t("feed.feedHide")}</div>
            <div className="text-xs text-default-400 line-clamp-1">
              {t("feed.feedHideDescription")}
            </div>
          </Checkbox>
          <Checkbox
            name="open_articles_in_browser"
            size="sm"
            classNames={{
              base: "w-full max-w-full p-0 mx-0 -mt-4  mb-1",
              label: "mt-4",
            }}
            isSelected={formData.open_articles_in_browser}
            onValueChange={(value) =>
              setFormData({ ...formData, open_articles_in_browser: value })
            }
          >
            <div className="line-clamp-1">{t("feed.feedOpenInBrowser")}</div>
            <div className="text-xs text-default-400 line-clamp-1">
              {t("feed.feedOpenInBrowserDescription")}
            </div>
          </Checkbox>
          <Accordion
            isCompact
            hideIndicator
            className="p-0"
            itemClasses={{
              base: "p-0",
              trigger: "p-0 gap-1 cursor-pointer group",
              title: "text-default-500 text-sm",
              content: "flex flex-col gap-4 pt-4 pb-0",
            }}
          >
            <AccordionItem
              key="advanced"
              aria-label="advanced"
              startContent={
                <>
                  <Plus className="size-4 text-default-500 group-data-[open=true]:hidden" />
                  <Minus className="size-4 text-default-500 hidden group-data-[open=true]:block" />
                </>
              }
              title={t("feed.advancedOptions")}
            >
              <Input
                labelPlacement="outside"
                size="sm"
                label={
                  <Link
                    isExternal
                    showAnchorIcon
                    color="foreground"
                    href="https://miniflux.app/docs/rules.html#feed-filtering-rules"
                    className="text-xs"
                  >
                    {t("feed.feedKeeplistRules")}
                  </Link>
                }
                variant="faded"
                name="keeplist_rules"
                placeholder={t("feed.feedKeeplistRulesPlaceholder")}
                value={formData.keeplist_rules}
                onValueChange={(value) =>
                  setFormData({ ...formData, keeplist_rules: value })
                }
              />
              <Input
                labelPlacement="outside"
                size="sm"
                label={
                  <Link
                    isExternal
                    showAnchorIcon
                    color="foreground"
                    href="https://miniflux.app/docs/rules.html#feed-filtering-rules"
                    className="text-xs"
                  >
                    {t("feed.feedBlocklistRules")}
                  </Link>
                }
                variant="faded"
                name="blocklist_rules"
                placeholder={t("feed.feedBlocklistRulesPlaceholder")}
                value={formData.blocklist_rules}
                onValueChange={(value) =>
                  setFormData({ ...formData, blocklist_rules: value })
                }
              />
              <Textarea
                labelPlacement="outside"
                size="sm"
                label={
                  <Link
                    isExternal
                    showAnchorIcon
                    color="foreground"
                    href="https://miniflux.app/docs/rules.html#rewrite-rules"
                    className="text-xs"
                  >
                    {t("feed.feedRewriteRules")}
                  </Link>
                }
                variant="faded"
                name="rewrite_rules"
                placeholder={t("feed.feedRewriteRulesPlaceholder")}
                value={formData.rewrite_rules}
                onValueChange={(value) =>
                  setFormData({ ...formData, rewrite_rules: value })
                }
              />
            </AccordionItem>
          </Accordion>
          <div className="flex flex-col md:flex-row-reverse gap-2 w-full">
            <Button
              color="primary"
              fullWidth
              type="submit"
              isLoading={loading}
              size="sm"
              className="border-primary border shadow-custom-button bg-primary bg-linear-to-b from-white/15 to-transparent text-sm"
            >
              {t("common.save")}
            </Button>
            <Button
              fullWidth
              onPress={onClose}
              size="sm"
              variant="flat"
              className="border text-sm"
            >
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </ScrollShadow>
    </CustomModal>
  );
}
