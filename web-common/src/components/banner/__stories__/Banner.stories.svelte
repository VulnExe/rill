<script lang="ts">
  import BannerCenter from "@rilldata/web-common/components/banner/BannerCenter.svelte";
  import {
    BillingBannerID,
    BillingBannerPriority,
  } from "@rilldata/web-common/components/banner/constants";
  import { Button } from "@rilldata/web-common/components/button/index.js";
  import Input from "@rilldata/web-common/components/forms/Input.svelte";
  import Select from "@rilldata/web-common/components/forms/Select.svelte";
  import { eventBus } from "@rilldata/web-common/lib/event-bus/event-bus";
  import { Story, Template } from "@storybook/addon-svelte-csf";

  let message: string;
  let type: string;
  let iconType: string;

  export const meta = {
    title: "Banner stories",
  };

  const bannerTypeOptions = [
    "default",
    "success",
    "info",
    "warning",
    "error",
  ].map((value) => ({ value, label: value }));
  const iconTypeOptions = ["none", "alert", "check", "sleep", "loading"].map(
    (value) => ({ value, label: value }),
  );

  function showBanner() {
    eventBus.emit("add-banner", {
      id: BillingBannerID,
      priority: BillingBannerPriority,
      message: {
        message,
        type: type as any,
        iconType: iconType as any,
        cta: {
          text: "contact us",
          type: "button",
        },
      },
    });
  }
</script>

<Template>
  <BannerCenter />
  <div class="flex flex-col p-5 gap-y-2">
    <Input id="message" label="Banner message" bind:value={message} />
    <Select
      id="type"
      label="Banner type"
      options={bannerTypeOptions}
      bind:value={type}
    />
    <Select
      id="icon-type"
      label="Icon type"
      options={iconTypeOptions}
      bind:value={iconType}
    />
    <Button type="primary" onClick={showBanner}>Show</Button>
  </div>
</Template>

<Story name="all banner variations" />
