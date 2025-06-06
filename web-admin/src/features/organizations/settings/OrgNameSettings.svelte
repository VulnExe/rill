<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    createAdminServiceGetOrganization,
    createAdminServiceUpdateOrganization,
    getAdminServiceGetOrganizationQueryKey,
    getAdminServiceListOrganizationsQueryKey,
    type RpcStatus,
  } from "@rilldata/web-admin/client";
  import { parseUpdateOrgError } from "@rilldata/web-admin/features/organizations/settings/errors";
  import SettingsContainer from "@rilldata/web-admin/features/organizations/settings/SettingsContainer.svelte";
  import { Button } from "@rilldata/web-common/components/button";
  import Input from "@rilldata/web-common/components/forms/Input.svelte";
  import { sanitizeOrgName } from "@rilldata/web-common/features/organization/sanitizeOrgName";
  import { eventBus } from "@rilldata/web-common/lib/event-bus/event-bus";
  import { queryClient } from "@rilldata/web-common/lib/svelte-query/globalQueryClient";
  import type { AxiosError } from "axios";
  import { defaults, superForm } from "sveltekit-superforms";
  import { yup } from "sveltekit-superforms/adapters";
  import { object, string } from "yup";

  export let organization: string;

  const initialValues: {
    name: string;
    description: string;
  } = {
    name: "",
    description: "",
  };
  const schema = yup(
    object({
      name: string().required(),
      description: string(),
    }),
  );

  const updateOrgMutation = createAdminServiceUpdateOrganization();

  const { form, errors, enhance, submit } = superForm(
    defaults(initialValues, schema),
    {
      SPA: true,
      validators: schema,
      async onUpdate({ form }) {
        if (!form.valid) return;
        const values = form.data;

        const newOrg = sanitizeOrgName(values.name);

        try {
          await $updateOrgMutation.mutateAsync({
            name: organization,
            data: {
              displayName: values.name,
              newName: newOrg,
              description: values.description,
            },
          });

          await queryClient.invalidateQueries({
            queryKey: getAdminServiceListOrganizationsQueryKey(),
          });
        } catch (err) {
          const parsedErr = parseUpdateOrgError(err);
          if (parsedErr.duplicateOrg) {
            form.errors.name = [`The name ${newOrg} is already taken`];
          }
          return;
        }

        if (organization !== newOrg) {
          queryClient.removeQueries({
            queryKey: getAdminServiceGetOrganizationQueryKey(organization),
          });
          setTimeout(() => goto(`/${newOrg}/-/settings`));
        } else {
          void queryClient.refetchQueries({
            queryKey: getAdminServiceGetOrganizationQueryKey(organization),
          });
        }
        eventBus.emit("notification", {
          message: "Updated organization",
        });
      },
      resetForm: false,
    },
  );

  $: orgResp = createAdminServiceGetOrganization(organization);
  $: if ($orgResp.data?.organization) {
    $form.name =
      $orgResp.data.organization.displayName || $orgResp.data.organization.name;
    $form.description = $orgResp.data.organization.description;
  }

  $: changed =
    $orgResp.data?.organization?.name !== $form.name ||
    $orgResp.data?.organization?.description !== $form.description;

  $: error = parseUpdateOrgError(
    $updateOrgMutation.error as unknown as AxiosError<RpcStatus>,
  );
</script>

<SettingsContainer title="Organization">
  <form
    slot="body"
    id="org-update-form"
    on:submit|preventDefault={submit}
    class="update-org-form"
    use:enhance
  >
    <Input
      bind:value={$form.name}
      errors={$errors?.name}
      id="name"
      label="Name"
      description={`Your org URL will be https://ui.rilldata.com/${sanitizeOrgName($form.name)}, to comply with our naming rules.`}
      textClass="text-sm"
      alwaysShowError
      additionalClass="max-w-[520px]"
    />
    <Input
      bind:value={$form.description}
      errors={$errors?.description}
      id="description"
      label="Description"
      placeholder="Describe your organization"
      textClass="text-sm"
      additionalClass="max-w-[520px]"
    />
  </form>
  {#if error?.message}
    <div class="text-red-500 text-sm py-px">
      {error.message}
    </div>
  {/if}
  <Button
    onClick={submit}
    type="primary"
    loading={$updateOrgMutation.isPending}
    disabled={!changed}
    slot="action"
  >
    Save
  </Button>
</SettingsContainer>

<style lang="postcss">
  .update-org-form {
    @apply flex flex-col gap-y-5 w-full;
  }
</style>
