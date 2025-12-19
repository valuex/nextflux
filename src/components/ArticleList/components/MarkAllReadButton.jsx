import { useParams } from "react-router-dom";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import { handleMarkAllRead } from "@/handlers/articleHandlers";
import { CircleCheck } from "lucide-react";
import { isSyncing } from "@/stores/syncStore.js";
import { useStore } from "@nanostores/react";
import { filter } from "@/stores/articlesStore.js";
import { useTranslation } from "react-i18next";

export default function MarkAllReadButton() {
  const { t } = useTranslation();
  const { feedId, categoryId } = useParams();
  const $isSyncing = useStore(isSyncing);
  const $filter = useStore(filter);
  return (
        <Button
          size="sm"
          radius="full"
          variant="light"
          isIconOnly
          isDisabled={$filter === "starred"}
          isLoading={$isSyncing}
          onPress={() => {
            if (feedId) {
              handleMarkAllRead("feed", feedId);
            } else if (categoryId) {
              handleMarkAllRead("category", categoryId);
            } else {
              handleMarkAllRead();
            }
          }}
        >
          <CircleCheck className="size-4 text-default-500" />
        </Button>
  );
}
