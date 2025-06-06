<script lang="ts">
  import { page } from "$app/stores";
  import {
    createAdminServiceCreateAlert,
    createAdminServiceGetCurrentUser,
  } from "@rilldata/web-admin/client";
  import { getHasSlackConnection } from "@rilldata/web-common/features/alerts/delivery-tab/notifiers-utils";
  import { SnoozeOptions } from "@rilldata/web-common/features/alerts/delivery-tab/snooze";
  import {
    type AlertFormValues,
    alertFormValidationSchema,
    getAlertQueryArgsFromFormValues,
  } from "@rilldata/web-common/features/alerts/form-utils";
  import { getEmptyMeasureFilterEntry } from "@rilldata/web-common/features/dashboards/filters/measure-filters/measure-filter-entry";
  import { getProtoFromDashboardState } from "@rilldata/web-common/features/dashboards/proto-state/toProto";
  import { getStateManagers } from "@rilldata/web-common/features/dashboards/state-managers/state-managers";
  import {
    mapSelectedComparisonTimeRangeToV1TimeRange,
    mapSelectedTimeRangeToV1TimeRange,
  } from "@rilldata/web-common/features/dashboards/time-controls/time-range-mappers";
  import { eventBus } from "@rilldata/web-common/lib/event-bus/event-bus";
  import {
    V1Operation,
    getRuntimeServiceListResourcesQueryKey,
  } from "@rilldata/web-common/runtime-client";
  import { useQueryClient } from "@tanstack/svelte-query";
  import { createEventDispatcher } from "svelte";
  import { createForm } from "svelte-forms-lib";
  import { get } from "svelte/store";
  import { runtime } from "../../runtime-client/runtime-store";
  import BaseAlertForm from "./BaseAlertForm.svelte";

  const user = createAdminServiceGetCurrentUser();
  const createAlert = createAdminServiceCreateAlert();
  $: organization = $page.params.organization;
  $: project = $page.params.project;
  const queryClient = useQueryClient();
  const dispatch = createEventDispatcher();

  const {
    metricsViewName,
    exploreName,
    dashboardStore,
    selectors: {
      timeRangeSelectors: { timeControlsState },
    },
    validSpecStore,
  } = getStateManagers();
  const timeControls = get(timeControlsState);

  $: ({ instanceId } = $runtime);

  // Set defaults depending on UI state
  // if in TDD take active measure and comparison dimension
  // If expanded leaderboard, take first dimension and active dimensions
  let dimension = "";
  if ($dashboardStore.tdd.expandedMeasureName) {
    dimension = $dashboardStore.selectedComparisonDimension ?? "";
  } else {
    dimension = $dashboardStore.selectedDimensionName ?? "";
  }

  // TODO: get metrics view spec
  const timeRange = mapSelectedTimeRangeToV1TimeRange(
    timeControls,
    $dashboardStore.selectedTimezone,
    {},
  );
  const comparisonTimeRange = mapSelectedComparisonTimeRangeToV1TimeRange(
    timeControls,
    timeRange,
  );

  $: exploreSpec = $validSpecStore.data?.explore ?? {};

  const formState = createForm<AlertFormValues>({
    initialValues: {
      name: "",
      measure:
        $dashboardStore.tdd.expandedMeasureName ??
        $dashboardStore.leaderboardSortByMeasureName ??
        "",
      splitByDimension: dimension,
      evaluationInterval: "",
      criteria: [
        {
          ...getEmptyMeasureFilterEntry(),
          measure: $dashboardStore.leaderboardSortByMeasureName ?? "",
        },
      ],
      criteriaOperation: V1Operation.OPERATION_AND,
      snooze: SnoozeOptions[0].value, // Defaults to `Off`
      enableSlackNotification: false,
      slackChannels: [
        {
          channel: "",
        },
      ],
      slackUsers: [
        { email: $user.data?.user?.email ? $user.data.user.email : "" },
        { email: "" },
      ],
      enableEmailNotification: true,
      emailRecipients: [
        { email: $user.data?.user?.email ? $user.data.user.email : "" },
        { email: "" },
      ],
      // The remaining fields are not editable in the form, but it's helpful to have access to them throughout the alert dialog
      // Also, in the future, they might even be editable.
      metricsViewName: $metricsViewName,
      exploreName: $exploreName,
      whereFilter: $dashboardStore.whereFilter,
      dimensionsWithInlistFilter: $dashboardStore.dimensionsWithInlistFilter,
      dimensionThresholdFilters: $dashboardStore.dimensionThresholdFilters,
      timeRange: timeRange
        ? {
            ...timeRange,
            end: timeControls.timeEnd,
          }
        : undefined,
      comparisonTimeRange: comparisonTimeRange
        ? {
            ...comparisonTimeRange,
            end: timeControls.timeEnd,
          }
        : undefined,
    } as AlertFormValues,
    validationSchema: alertFormValidationSchema,
    onSubmit: async (values) => {
      try {
        await $createAlert.mutateAsync({
          organization,
          project,
          data: {
            options: {
              displayName: values.name,
              queryName: "MetricsViewAggregation",
              queryArgsJson: JSON.stringify(
                getAlertQueryArgsFromFormValues(values),
              ),
              metricsViewName: values.metricsViewName,
              slackChannels: values.enableSlackNotification
                ? values.slackChannels.map((c) => c.channel).filter(Boolean)
                : undefined,
              slackUsers: values.enableSlackNotification
                ? values.slackUsers.map((c) => c.email).filter(Boolean)
                : undefined,
              emailRecipients: values.enableEmailNotification
                ? values.emailRecipients.map((r) => r.email).filter(Boolean)
                : undefined,
              renotify: !!values.snooze,
              renotifyAfterSeconds: values.snooze ? Number(values.snooze) : 0,
              webOpenPath: `/explore/${encodeURIComponent($exploreName)}`,
              webOpenState: getProtoFromDashboardState(
                $dashboardStore,
                exploreSpec,
              ),
            },
          },
        });
        await queryClient.invalidateQueries({
          queryKey: getRuntimeServiceListResourcesQueryKey(instanceId),
        });
        dispatch("close");
        eventBus.emit("notification", {
          message: "Alert created",
          link: {
            href: `/${organization}/${project}/-/alerts`,
            text: "Go to alerts",
          },
        });
      } catch {
        // showing error below
      }
    },
  });

  const { form } = formState;
  $: hasSlackNotifier = getHasSlackConnection(instanceId);
  $: if ($hasSlackNotifier.data) {
    $form["enableSlackNotification"] = true;
  }

  $: if (timeControls.timeEnd) {
    $form["timeRange"].end = timeControls.timeEnd;
  }
  $: if (timeControls.comparisonTimeEnd && $form["comparisonTimeRange"]) {
    $form["comparisonTimeRange"].end = timeControls.comparisonTimeEnd;
  }
</script>

<BaseAlertForm {formState} isEditForm={false} on:cancel on:close />
