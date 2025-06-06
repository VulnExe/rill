<script lang="ts">
  import { Button } from "@rilldata/web-common/components/button";
  import * as DropdownMenu from "@rilldata/web-common/components/dropdown-menu";
  import RefreshIcon from "@rilldata/web-common/components/icons/RefreshIcon.svelte";
  import Tooltip from "@rilldata/web-common/components/tooltip/Tooltip.svelte";
  import TooltipContent from "@rilldata/web-common/components/tooltip/TooltipContent.svelte";
  import {
    V1ReconcileStatus,
    type V1Resource,
    createRuntimeServiceCreateTrigger,
  } from "@rilldata/web-common/runtime-client";
  import { runtime } from "../../../runtime-client/runtime-store";

  export let resource: V1Resource | undefined;
  export let hasUnsavedChanges: boolean;

  const triggerMutation = createRuntimeServiceCreateTrigger();

  $: ({ instanceId } = $runtime);
  $: isIncrementalModel = resource?.model?.spec?.incremental;
  $: isModelIdle =
    resource?.meta?.reconcileStatus === V1ReconcileStatus.RECONCILE_STATUS_IDLE;

  function refreshModel(full: boolean) {
    void $triggerMutation.mutateAsync({
      instanceId,
      data: {
        models: [{ model: resource?.meta?.name?.name, full: full }],
      },
    });
  }
</script>

{#if isIncrementalModel}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger asChild let:builder>
      <Tooltip distance={8}>
        <Button
          square
          type="secondary"
          builders={[builder]}
          disabled={!isModelIdle || hasUnsavedChanges}
          label="Refresh Incremental Model"
        >
          <RefreshIcon size="14px" />
        </Button>
        <TooltipContent slot="tooltip-content">
          {#if hasUnsavedChanges}
            Save your changes to refresh
          {:else}
            Refresh model
          {/if}
        </TooltipContent>
      </Tooltip>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content align="end">
      <DropdownMenu.Item on:click={() => refreshModel(false)}>
        Incremental refresh
      </DropdownMenu.Item>
      <DropdownMenu.Item on:click={() => refreshModel(true)}>
        Full refresh
      </DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{:else}
  <Tooltip distance={8}>
    <Button
      square
      disabled={hasUnsavedChanges}
      type="secondary"
      label="Refresh Model"
      onClick={() => refreshModel(true)}
    >
      <RefreshIcon size="14px" />
    </Button>
    <TooltipContent slot="tooltip-content">
      {#if hasUnsavedChanges}
        Save your changes to refresh
      {:else}
        Refresh model
      {/if}
    </TooltipContent>
  </Tooltip>
{/if}
