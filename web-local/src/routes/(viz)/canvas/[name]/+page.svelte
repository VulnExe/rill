<script lang="ts">
  import { onNavigate } from "$app/navigation";
  import CanvasDashboardEmbed from "@rilldata/web-common/features/canvas/CanvasDashboardEmbed.svelte";
  import CanvasThemeProvider from "@rilldata/web-common/features/canvas/CanvasThemeProvider.svelte";
  import type { PageData } from "./$types";
  import {
    DashboardBannerID,
    DashboardBannerPriority,
  } from "@rilldata/web-common/components/banner/constants";
  import { eventBus } from "@rilldata/web-common/lib/event-bus/event-bus";

  export let data: PageData;

  $: canvasName = data.dashboardName;
  $: hasBanner = !!data.dashboard.canvas?.state?.validSpec?.banner;

  $: if (hasBanner) {
    eventBus.emit("add-banner", {
      id: DashboardBannerID,
      priority: DashboardBannerPriority,
      message: {
        type: "default",
        message: data.dashboard.canvas?.state?.validSpec?.banner ?? "",
        iconType: "alert",
      },
    });
  }

  onNavigate(() => {
    if (hasBanner) {
      eventBus.emit("remove-banner", DashboardBannerID);
    }
  });
</script>

<CanvasThemeProvider {canvasName}>
  <CanvasDashboardEmbed resource={data.dashboard} />
</CanvasThemeProvider>
