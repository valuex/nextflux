import { filter } from "@/stores/articlesStore";
import { CircleDot, Star, Text } from "lucide-react";
import { Tab, Tabs } from "@heroui/react";
import { useStore } from "@nanostores/react";
import AudioPlayer from "@/components/ArticleView/components/AudioPlayer.jsx";
import { activeAudio } from "@/stores/audioStore.js";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";


export default function ArticleListFooter() {
  const { t } = useTranslation();
  // const $filter = useStore(filter);
  const $activeAudio = useStore(activeAudio);

  // Only render the footer when there's active audio
  if (!$activeAudio) {
    return null;
  }

  return (
    <div className="article-list-footer absolute bottom-0 w-full bg-transparent flex flex-col items-center justify-center pb-4 standalone:pb-safe-or-4">
      <AnimatePresence initial={false} mode="wait">
        <AudioPlayer source={$activeAudio} />
      </AnimatePresence>
    </div>
  );
}
