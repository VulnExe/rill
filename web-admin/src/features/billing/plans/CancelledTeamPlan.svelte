<script lang="ts">
  import type { V1BillingPlan } from "@rilldata/web-admin/client";
  import ContactUs from "@rilldata/web-admin/features/billing/ContactUs.svelte";
  import PlanQuotas from "@rilldata/web-admin/features/billing/plans/PlanQuotas.svelte";
  import StartTeamPlanDialog from "@rilldata/web-admin/features/billing/plans/StartTeamPlanDialog.svelte";
  import { useCategorisedOrganizationBillingIssues } from "@rilldata/web-admin/features/billing/selectors";
  import SettingsContainer from "@rilldata/web-admin/features/organizations/settings/SettingsContainer.svelte";
  import { Button } from "@rilldata/web-common/components/button";
  import InfoCircleFilled from "@rilldata/web-common/components/icons/InfoCircleFilled.svelte";
  import { DateTime } from "luxon";

  export let organization: string;
  export let plan: V1BillingPlan;
  export let showUpgradeDialog: boolean;

  $: categorisedIssues = useCategorisedOrganizationBillingIssues(organization);
  $: cancelledSubIssue = $categorisedIssues.data?.cancelled;

  let willEndOnText = "";
  $: if (cancelledSubIssue?.metadata.subscriptionCancelled?.endDate) {
    const endDate = DateTime.fromJSDate(
      new Date(cancelledSubIssue.metadata.subscriptionCancelled.endDate),
    );
    if (endDate.isValid && endDate.toMillis() > Date.now())
      willEndOnText = endDate.toLocaleString(DateTime.DATE_MED);
  }

  let open = showUpgradeDialog;
</script>

<SettingsContainer title={plan?.displayName || "Team plan"}>
  <div slot="body">
    <div>
      <div class="flex flex-row items-center gap-x-1 text-sm">
        <InfoCircleFilled className="text-yellow-500" size="14px" />
        Your plan is cancelled
        {#if willEndOnText}
          but you still have access until <b>{willEndOnText}.</b>
        {:else}
          and your subscription has ended.
        {/if}
      </div>
      {#if plan}
        <!-- if there is no plan then quotas will be set to 0. It doesnt make sense to show this then -->
        <PlanQuotas {organization} />
      {/if}
    </div>
  </div>
  <svelte:fragment slot="contact">
    <span>For custom enterprise needs,</span>
    <ContactUs />
  </svelte:fragment>

  <Button type="primary" slot="action" onClick={() => (open = true)}>
    Renew Team plan
  </Button>
</SettingsContainer>

{#if !$categorisedIssues.isLoading}
  <StartTeamPlanDialog
    bind:open
    {organization}
    type="renew"
    endDate={cancelledSubIssue?.metadata.subscriptionCancelled?.endDate}
  />
{/if}
