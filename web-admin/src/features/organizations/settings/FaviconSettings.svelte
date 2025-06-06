<script lang="ts">
  import { invalidate } from "$app/navigation";
  import {
    createAdminServiceUpdateOrganization,
    getAdminServiceGetOrganizationQueryKey,
  } from "@rilldata/web-admin/client";
  import { getRpcErrorMessage } from "@rilldata/web-admin/components/errors/error-utils";
  import SettingsContainer from "@rilldata/web-admin/features/organizations/settings/SettingsContainer.svelte";
  import UploadImagePopover from "@rilldata/web-admin/features/organizations/settings/UploadImagePopover.svelte";
  import { Button } from "@rilldata/web-common/components/button";
  import { queryClient } from "@rilldata/web-common/lib/svelte-query/globalQueryClient";

  export let organization: string;
  export let organizationFaviconUrl: string | undefined;

  const orgUpdater = createAdminServiceUpdateOrganization();
  $: ({ error, isPending: isLoading, mutateAsync } = $orgUpdater);

  async function onSave(assetId: string) {
    await mutateAsync({
      name: organization,
      data: {
        faviconAssetId: assetId,
      },
    });
    void queryClient.invalidateQueries({
      queryKey: getAdminServiceGetOrganizationQueryKey(organization),
    });
    void invalidate("app:root");
  }

  async function onRemove() {
    await mutateAsync({
      name: organization,
      data: {
        faviconAssetId: "",
      },
    });
    void queryClient.invalidateQueries({
      queryKey: getAdminServiceGetOrganizationQueryKey(organization),
    });
    void invalidate("app:root");
  }
</script>

<SettingsContainer title="Favicon" suppressFooter={!organizationFaviconUrl}>
  <div slot="body" class="flex flex-col gap-y-2">
    <div>
      Click to upload your favicon and customize Rill for your organization.
      Upload a square icon to get the best results.
    </div>
    <UploadImagePopover
      imageUrl={organizationFaviconUrl}
      accept="image/png, image/ico, image/x-ico, image/icon, image/x-icon"
      label="favicon"
      {organization}
      loading={isLoading}
      error={getRpcErrorMessage(error)}
      {onSave}
      {onRemove}
    >
      <img src="/favicon.png" alt="favicon" class="h-10" />
    </UploadImagePopover>
  </div>
  <svelte:fragment slot="action">
    {#if organizationFaviconUrl}
      <Button
        type="secondary"
        onClick={onRemove}
        loading={isLoading}
        disabled={isLoading}
      >
        Remove
      </Button>
    {/if}
  </svelte:fragment>
</SettingsContainer>
