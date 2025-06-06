<script lang="ts">
  import Tooltip from "@rilldata/web-common/components/tooltip/Tooltip.svelte";
  import TooltipContent from "@rilldata/web-common/components/tooltip/TooltipContent.svelte";
  import ColumnProfile from "@rilldata/web-common/features/column-profile/ColumnProfile.svelte";
  import { getSummaries } from "@rilldata/web-common/features/column-profile/queries";
  import ReconcilingSpinner from "@rilldata/web-common/features/entity-management/ReconcilingSpinner.svelte";
  import {
    formatConnectorType,
    getFileExtension,
  } from "@rilldata/web-common/features/sources/sourceUtils";
  import CollapsibleSectionTitle from "@rilldata/web-common/layout/CollapsibleSectionTitle.svelte";
  import SimpleMessage from "@rilldata/web-common/layout/inspector/SimpleMessage.svelte";
  import Inspector from "@rilldata/web-common/layout/workspace/Inspector.svelte";
  import {
    formatBigNumberPercentage,
    formatInteger,
  } from "@rilldata/web-common/lib/formatters";
  import {
    type V1Resource,
    createQueryServiceTableCardinality,
    createQueryServiceTableColumns,
  } from "@rilldata/web-common/runtime-client";
  import { keepPreviousData } from "@tanstack/svelte-query";
  import { derived } from "svelte/store";
  import { slide } from "svelte/transition";
  import { LIST_SLIDE_DURATION } from "../../../layout/config";
  import InspectorHeaderGrid from "../../../layout/inspector/InspectorHeaderGrid.svelte";
  import { runtime } from "../../../runtime-client/runtime-store";
  import IncrementalProcessing from "../incremental/IncrementalProcessing.svelte";
  import PartitionsBrowser from "../partitions/PartitionsBrowser.svelte";
  import References from "./References.svelte";
  import WithModelResultTooltip from "./WithModelResultTooltip.svelte";

  export let filePath: string;
  export let resource: V1Resource | undefined;
  export let connector: string;
  export let database: string;
  export let databaseSchema: string;
  export let tableName: string;
  export let isEmpty = false;
  export let isResourceReconciling: boolean = false;
  export let hasErrors: boolean;
  export let hasUnsavedChanges: boolean;

  let showColumns = true;

  $: ({ instanceId } = $runtime);
  $: source = resource?.source;
  $: model = resource?.model;

  $: connectorType = source && formatConnectorType(source);
  $: fileExtension = source && getFileExtension(source);

  $: cardinalityQuery = createQueryServiceTableCardinality(
    instanceId,
    tableName,
    {
      connector,
      database,
      databaseSchema,
    },
  );

  $: profileColumnsQuery = createQueryServiceTableColumns(
    instanceId,
    tableName,
    {
      connector,
      database,
      databaseSchema,
    },
    {
      query: {
        placeholderData: keepPreviousData,
      },
    },
  );

  $: cardinality = Number($cardinalityQuery?.data?.cardinality ?? 0);

  $: profileColumnsCount =
    $profileColumnsQuery?.data?.profileColumns?.length ?? 0;

  $: rowCount = `${formatInteger(cardinality)} ${
    cardinality !== 1 ? "rows" : "row"
  }`;

  $: columnCount = `${formatInteger(profileColumnsCount)} columns`;

  $: summaries = getSummaries(
    instanceId,
    connector,
    database,
    databaseSchema,
    tableName,
    $profileColumnsQuery,
  );

  $: totalCells = profileColumnsCount * cardinality;

  $: totalNulls = $summaries?.reduce(
    (total, column) => total + (column?.nullCount ?? 0),
    0,
  );

  $: nullPercentage =
    totalNulls !== undefined
      ? formatBigNumberPercentage(totalNulls / totalCells)
      : undefined;

  $: resourceRefs = resource?.meta?.refs ?? [];

  $: cardinalityQueries = resourceRefs.map((ref) => {
    return createQueryServiceTableCardinality(
      instanceId,
      ref.name as string,
      {
        connector,
        database,
        databaseSchema,
      },
      {
        query: {
          select: (data) => +(data?.cardinality ?? 0),
        },
      },
    );
  });

  $: sourceProfileColumns =
    resourceRefs.map((ref) => {
      return createQueryServiceTableColumns(
        instanceId,
        ref.name as string,
        {
          connector,
          database,
          databaseSchema,
        },
        {
          query: {
            select: (data) => data?.profileColumns?.length || 0,
          },
        },
      );
    }) ?? [];

  $: inputCardinalities = derived(cardinalityQueries, ($cardinalities) => {
    return $cardinalities
      .map((c) => c?.data ?? 0)
      .reduce((total: number, cardinality: number) => total + cardinality, 0);
  });

  $: sourceColumns = derived(
    sourceProfileColumns,
    (columns) =>
      columns
        .map((col) => col.data ?? 0)
        .reduce((total, columns) => columns + total, 0),

    0,
  );

  $: rollup = cardinality / $inputCardinalities;

  $: columnDelta = profileColumnsCount - $sourceColumns;
  $: isIncremental = model?.spec?.incremental;
  $: isPartitioned = !!model?.state?.partitionsModelId;
</script>

<Inspector {filePath}>
  <div class="wrapper" class:grayscale={hasUnsavedChanges}>
    {#if isEmpty}
      <div class="px-4 py-24 italic ui-copy-disabled text-center">
        {source ? "Source" : "Model"} is empty.
      </div>
    {:else if isResourceReconciling}
      <div class="size-full flex items-center justify-center">
        <ReconcilingSpinner />
      </div>
    {:else if !!resource && !!connector && !!tableName}
      <InspectorHeaderGrid>
        <svelte:fragment slot="top-left">
          {#if source}
            <p>
              {connectorType}
              {fileExtension && `(${fileExtension})`}
            </p>
          {:else}
            <WithModelResultTooltip modelHasError={hasErrors}>
              <p>
                {#if isNaN(rollup)}
                  ~
                {:else if rollup === 0}
                  Result set is empty
                {:else if rollup === Infinity}
                  {rowCount} selected
                {:else if rollup !== 1}
                  {formatBigNumberPercentage(rollup)}
                  of source rows
                {:else}
                  No change in row count
                {/if}
              </p>

              <svelte:fragment slot="tooltip-title">
                Rollup percentage
              </svelte:fragment>
              <svelte:fragment slot="tooltip-description"
                >The ratio of resultset rows to source rows, as a percentage.
              </svelte:fragment>
            </WithModelResultTooltip>
          {/if}
        </svelte:fragment>
        <svelte:fragment slot="top-right">{rowCount}</svelte:fragment>

        <svelte:fragment slot="bottom-left">
          {#if source}
            <Tooltip location="left" alignment="start" distance={24}>
              {#if nullPercentage !== undefined}
                <p>{nullPercentage} null</p>
              {/if}

              <TooltipContent slot="tooltip-content">
                {#if nullPercentage !== undefined}
                  {nullPercentage} of table values are null
                {:else}
                  awaiting calculation of total null table values
                {/if}
              </TooltipContent>
            </Tooltip>
          {:else}
            <WithModelResultTooltip modelHasError={hasErrors}>
              <div
                class:font-normal={hasErrors}
                class:text-gray-500={hasErrors}
              >
                {#if columnDelta > 0}
                  {formatInteger(columnDelta)}
                  {columnDelta === 1 ? "column" : "columns"} added
                {:else if columnDelta < 0}
                  {formatInteger(-columnDelta)}
                  {-columnDelta === 1 ? "column" : "columns"} dropped
                {:else}
                  No change in column count
                {/if}
              </div>

              <svelte:fragment slot="tooltip-title">Column diff</svelte:fragment
              >
              <svelte:fragment slot="tooltip-description">
                The difference in column counts between the sources and model.
              </svelte:fragment>
            </WithModelResultTooltip>
          {/if}
        </svelte:fragment>

        <svelte:fragment slot="bottom-right">{columnCount}</svelte:fragment>
      </InspectorHeaderGrid>

      <hr />
      <References refs={resourceRefs} modelHasError={hasErrors} />
      <hr />

      <div>
        <div class="px-4">
          <CollapsibleSectionTitle
            tooltipText="available columns"
            bind:active={showColumns}
          >
            {model ? "Model columns" : "Source columns"}
          </CollapsibleSectionTitle>
        </div>

        {#if showColumns}
          <div transition:slide={{ duration: LIST_SLIDE_DURATION }}>
            <ColumnProfile
              {connector}
              {database}
              {databaseSchema}
              objectName={tableName}
              indentLevel={0}
            />
          </div>
        {/if}
      </div>

      {#if model}
        {#if isPartitioned}
          <hr />
          <PartitionsBrowser {resource} />
        {:else if isIncremental}
          <hr />
          <IncrementalProcessing {resource} />
        {/if}
      {/if}
    {:else if hasErrors}
      <SimpleMessage message="Fix the errors in the file to continue." />
    {/if}
  </div>
</Inspector>

<style lang="postcss">
  .wrapper {
    @apply transition duration-200 py-2 flex flex-col gap-y-2;
  }
</style>
