import { getCurrentUserId } from "@/lib/auth";
import { listUserGuides } from "@/lib/study-guides";
import { GuidesClient } from "@/components/guides/guides-client";

export default async function GuidesPage() {
  const userId = await getCurrentUserId();
  const guides = await listUserGuides(userId);

  return (
    <GuidesClient
      guides={guides.map((g) => ({
        id: g.id,
        title: g.title,
        createdAt: g.createdAt.toISOString(),
        sourceNames: g.sourceNames,
      }))}
    />
  );
}
