import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/chat/")({
  component: ChatEmpty,
});

function ChatEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center chat-bg-pattern">
      <div className="bg-card/80 backdrop-blur px-6 py-5 rounded-2xl text-center shadow-sm border">
        <MessageCircle className="w-12 h-12 mx-auto mb-3 text-primary" />
        <h2 className="font-semibold">Suhbatlaringiz shu yerda paydo bo'ladi</h2>
        <p className="text-sm text-muted-foreground mt-1">Kimnidir topish uchun foydalanuvchi nomini qidiring</p>
      </div>
    </div>
  );
}
