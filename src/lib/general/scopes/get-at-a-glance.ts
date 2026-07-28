import type { AtAGlanceType } from "@/types/misc/at-a-glance.type.ts";

const atAGlanceMessages = [
  {
    "title"   : "A promising future",
    "subtitle": "without JavaScript",
  },
  {
    "title"   : "These messages",
    "subtitle": "were inspired by the \"At a Glance\" android widget",
  },
  {
    "title"   : "Kaede",
    "subtitle": "was not built in a day",
  },
  {
    "title"   : "%date%",
    "subtitle": "What a great day to play Minecraft, right?",
  },
];

function transformAtAGlanceMessages(message: AtAGlanceType): AtAGlanceType {
  const currentDate = (new Date)
    .toDateString()
    .split(" ");

  const formattedDate = (
    currentDate[0] + ", " + currentDate[1] + " " + currentDate[2]
  );

  message.title = message.title.replace("%date%", () => formattedDate);

  return message;
}

export function getAtAGlance(currentTitle?: string): AtAGlanceType {
  const randomIndex = Math.floor(
    Math.random() * atAGlanceMessages.length,
  );
  const newMessage = atAGlanceMessages[randomIndex];

  if (currentTitle === newMessage.title) {
    const uniqueIndex = randomIndex - 1;

    if (uniqueIndex < 0) {
      return transformAtAGlanceMessages(atAGlanceMessages[randomIndex + 1]);
    }

    return transformAtAGlanceMessages(atAGlanceMessages[uniqueIndex]);
  }

  return transformAtAGlanceMessages(newMessage);
}
