import { atom } from "nanostores";
import {
  getFeeds,
  getArticlesCount,
  getArticlesByPage,
  addArticles,
  getUnreadCount,
  getStarredCount,
} from "../db/storage";
import minifluxAPI from "../api/miniflux";
import { starredCounts, unreadCounts } from "./feedsStore.js";
import { settingsState } from "./settingsStore";

export const filteredArticles = atom([]);
export const activeArticle = atom(null);
export const loading = atom(false); // 加载文章列表
export const loadingMore = atom(false); // 加载更多文章
export const loadingOriginContent = atom(false);
export const error = atom(null);
export const filter = atom("all");
export const imageGalleryActive = atom(false);
export const hasMore = atom(true);
export const currentPage = atom(1);
export const pageSize = atom(30);
export const visibleRange = atom({
  startIndex: 0,
  endIndex: 0,
});

// 加载文章列表
export async function loadArticles(
  sourceId = null,
  type = "feed",
  page = 1,
  append = false,
) {
  error.set(null);

  try {
    const feeds = await getFeeds();
    const settings = settingsState.get();
    const showHiddenFeeds = settings.showHiddenFeeds;
    let targetFeeds;

    // 根据类型确定要加载的订阅源
    if (type === "category" && sourceId) {
      targetFeeds = feeds.filter(
        (feed) =>
          feed.categoryId === parseInt(sourceId) &&
          (showHiddenFeeds || !feed.hide_globally),
      );
    } else if (sourceId) {
      targetFeeds = feeds.filter(
        (feed) =>
          feed.id === parseInt(sourceId) &&
          (showHiddenFeeds || !feed.hide_globally),
      );
    } else {
      targetFeeds = showHiddenFeeds
        ? feeds
        : feeds.filter((feed) => !feed.hide_globally);
    }

    // 获取目标订阅源的文章总数
    const total = await getArticlesCount(
      targetFeeds.map((feed) => feed.id),
      filter.get(),
    );

    // 分页获取文章
    const articles = await getArticlesByPage(
      targetFeeds.map((feed) => feed.id),
      filter.get(),
      page,
      pageSize.get(),
      settings.sortDirection,
      settings.sortField,
    );

    // 计算分页状态
    const isMore = articles.length === pageSize.get();

    // 根据是否追加来更新文章列表
    if (append) {
      filteredArticles.set([...filteredArticles.get(), ...articles]);
      hasMore.set(isMore);
      currentPage.set(page);
    }

    return { articles: articles, total, isMore };
  } catch (err) {
    console.error("加载文章失败:", err);
    error.set("加载文章失败");
  }
}

// 更新文章未读状态
export async function updateArticleStatus(article) {
  const newStatus = article.status === "read" ? "unread" : "read";

  // 乐观更新UI
  filteredArticles.set(
    filteredArticles
      .get()
      .map((a) => (a.id === article.id ? { ...a, status: newStatus } : a)),
  );

  try {
    // 并行执行在线和本地更新
    const updates = [
      // 如果在线则更新服务器
      navigator.onLine && minifluxAPI.updateEntryStatus(article),
      // 更新本地数据库
      addArticles([
        {
          ...article,
          status: newStatus,
        },
      ]),
      // 更新未读计数
      (async () => {
        const count = await getUnreadCount(article.feedId);
        const currentCounts = unreadCounts.get();
        unreadCounts.set({
          ...currentCounts,
          [article.feedId]: count,
        });
      })(),
    ].filter(Boolean);

    await Promise.all(updates);
  } catch (err) {
    // 发生错误时回滚UI状态
    filteredArticles.set(
      filteredArticles
        .get()
        .map((a) =>
          a.id === article.id ? { ...a, status: article.status } : a,
        ),
    );
    console.error("更新文章状态失败:", err);
    throw err;
  }
}

// 更新文章收藏状态
export async function updateArticleStarred(article) {
  const newStarred = article.starred === 1 ? 0 : 1;

  // 乐观更新UI
  filteredArticles.set(
    filteredArticles
      .get()
      .map((a) => (a.id === article.id ? { ...a, starred: newStarred } : a)),
  );

  try {
    // 并行执行在线和本地更新
    const updates = [
      // 如果在线则更新服务器
      navigator.onLine && minifluxAPI.updateEntryStarred(article),
      // 更新本地数据库
      addArticles([
        {
          ...article,
          starred: newStarred,
        },
      ]),
      // 更新收藏计数
      (async () => {
        const count = await getStarredCount(article.feedId);
        const currentCounts = starredCounts.get();
        starredCounts.set({
          ...currentCounts,
          [article.feedId]: count,
        });
      })(),
    ].filter(Boolean);

    await Promise.all(updates);
  } catch (err) {
    // 发生错误时回滚UI状态
    filteredArticles.set(
      filteredArticles
        .get()
        .map((a) =>
          a.id === article.id ? { ...a, starred: article.starred } : a,
        ),
    );
    console.error("更新文章星标状态失败:", err);
    throw err;
  }
}

// 改进后的 markAllAsRead 函数 - 优化为乐观更新
export async function markAllAsRead(type = "all", id = null) {
  // 获取当前页面的文章
  const articles = filteredArticles.get();
  const currentCounts = unreadCounts.get();
  const updatedCounts = { ...currentCounts };
  
  let affectedArticles = [];
  let categoryFeedIds = [];

  try {
    // 预先获取 feeds（如果需要）以避免多次调用
    if (type === "category" && id) {
      const feeds = await getFeeds();
      categoryFeedIds = feeds
        .filter((feed) => feed.categoryId === parseInt(id))
        .map((feed) => feed.id);
    }

    // 确定受影响的文章和需要更新的计数
    if (type === "feed" && id) {
      affectedArticles = articles.filter(
        (article) => article.feedId === parseInt(id) && article.status !== "read"
      );
      updatedCounts[id] = 0;
    } else if (type === "category" && id) {
      affectedArticles = articles.filter(
        (article) => categoryFeedIds.includes(article.feedId) && article.status !== "read"
      );
      categoryFeedIds.forEach((feedId) => {
        updatedCounts[feedId] = 0;
      });
    } else {
      affectedArticles = articles.filter((article) => article.status !== "read");
      Object.keys(updatedCounts).forEach((feedId) => {
        updatedCounts[feedId] = 0;
      });
    }

    // 乐观更新：立即更新 UI
    if (affectedArticles.length > 0) {
      filteredArticles.set(
        articles.map((article) =>
          affectedArticles.some((a) => a.id === article.id)
            ? { ...article, status: "read" }
            : article
        )
      );
    }
    unreadCounts.set(updatedCounts);

    // 异步执行后台同步，不等待完成
    Promise.all([
      // 调用服务器 API
      navigator.onLine ? minifluxAPI.markAllAsRead(type, id) : Promise.resolve(),
      // 更新本地数据库（仅更新受影响的文章）
      affectedArticles.length > 0
        ? addArticles(
            affectedArticles.map((article) => ({
              ...article,
              status: "read",
            }))
          )
        : Promise.resolve(),
    ]).catch((err) => {
      console.error("后台同步标记已读失败:", err);
      // 如果失败，可以考虑回滚 UI 或显示错误提示
      // 但不抛出错误，因为 UI 已经更新
    });
  } catch (err) {
    console.error("标记已读失败:", err);
    throw err;
  }
}

// Mark articles above a specific article as read (including the current article)
export async function markAboveAsRead(articleId) {
  const articles = filteredArticles.get();
  const articleIndex = articles.findIndex((a) => a.id === articleId);

  if (articleIndex < 0) {
    return; // Article not found
  }

  // Get all articles above and including the current one that are unread
  const articlesToMark = articles
    .slice(0, articleIndex + 1)
    .filter((article) => article.status !== "read");

  if (articlesToMark.length === 0) {
    return;
  }

  // Group by feed for count updates
  const articlesByFeed = articlesToMark.reduce((acc, article) => {
    acc[article.feedId] = acc[article.feedId] || [];
    acc[article.feedId].push(article);
    return acc;
  }, {});

  // Optimistically update UI
  filteredArticles.set(
    articles.map((article) =>
      articlesToMark.some((a) => a.id === article.id)
        ? { ...article, status: "read" }
        : article
    ),
  );

  try {
    await Promise.all([
      // Update server
      navigator.onLine && Promise.all(
        articlesToMark.map((article) => minifluxAPI.updateEntryStatus(article))
      ),

      // Update local database
      addArticles(
        articlesToMark.map((article) => ({
          ...article,
          status: "read",
        })),
      ),

      // Update unread counts using subtraction
      (async () => {
        const currentCounts = unreadCounts.get();
        const updatedCounts = { ...currentCounts };

        // Subtract the number of marked articles from each feed's count
        Object.entries(articlesByFeed).forEach(([feedId, articles]) => {
          const currentCount = currentCounts[feedId] || 0;
          updatedCounts[feedId] = Math.max(0, currentCount - articles.length);
        });

        unreadCounts.set(updatedCounts);
      })(),
    ].filter(Boolean));
  } catch (err) {
    filteredArticles.set(articles);
    console.error("标记上方为已读失败:", err);
    throw err;
  }
}

// Mark articles below a specific article as read
export async function markBelowAsRead(articleId) {
  const articles = filteredArticles.get();
  const articleIndex = articles.findIndex((a) => a.id === articleId);

  if (articleIndex === -1 || articleIndex >= articles.length - 1) {
    return; // No articles below
  }

  // Get all articles below the current one that are unread
  const articlesToMark = articles
    .slice(articleIndex)
    .filter((article) => article.status !== "read");

  if (articlesToMark.length === 0) {
    return;
  }

  // Group by feed for count updates
  const articlesByFeed = articlesToMark.reduce((acc, article) => {
    acc[article.feedId] = acc[article.feedId] || [];
    acc[article.feedId].push(article);
    return acc;
  }, {});

  // Optimistically update UI
  filteredArticles.set(
    articles.map((article) =>
      articlesToMark.some((a) => a.id === article.id)
        ? { ...article, status: "read" }
        : article
    ),
  );

  try {
    await Promise.all([
      // Update server
      navigator.onLine && Promise.all(
        articlesToMark.map((article) => minifluxAPI.updateEntryStatus(article))
      ),

      // Update local database
      addArticles(
        articlesToMark.map((article) => ({
          ...article,
          status: "read",
        })),
      ),

      // Update unread counts using subtraction
      (async () => {
        const currentCounts = unreadCounts.get();
        const updatedCounts = { ...currentCounts };

        // Subtract the number of marked articles from each feed's count
        Object.entries(articlesByFeed).forEach(([feedId, articles]) => {
          const currentCount = currentCounts[feedId] || 0;
          updatedCounts[feedId] = Math.max(0, currentCount - articles.length);
        });

        unreadCounts.set(updatedCounts);
      })(),
    ].filter(Boolean));
  } catch (err) {
    filteredArticles.set(articles);
    console.error("标记下方为已读失败:", err);
    throw err;
  }
}
