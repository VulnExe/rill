import type { CanvasResolvedSpec } from "@rilldata/web-common/features/canvas/stores/spec";
import { DimensionFilterMode } from "@rilldata/web-common/features/dashboards/filters/dimension-filters/dimension-filter-mode";
import { getFiltersFromText } from "@rilldata/web-common/features/dashboards/filters/dimension-filters/dimension-search-text-utils";
import {
  getDimensionDisplayName,
  getMeasureDisplayName,
} from "@rilldata/web-common/features/dashboards/filters/getDisplayName";
import type { MeasureFilterEntry } from "@rilldata/web-common/features/dashboards/filters/measure-filters/measure-filter-entry";
import {
  mergeDimensionAndMeasureFilters,
  splitWhereFilter,
} from "@rilldata/web-common/features/dashboards/filters/measure-filters/measure-filter-utils";
import {
  type DimensionFilterItem,
  getDimensionFilters,
} from "@rilldata/web-common/features/dashboards/state-managers/selectors/dimension-filters";
import { filterItemsSortFunction } from "@rilldata/web-common/features/dashboards/state-managers/selectors/filters";
import type { MeasureFilterItem } from "@rilldata/web-common/features/dashboards/state-managers/selectors/measure-filters";
import type { DimensionThresholdFilter } from "@rilldata/web-common/features/dashboards/stores/explore-state";
import {
  createAndExpression,
  createInExpression,
  createLikeExpression,
  getValueIndexInExpression,
  getValuesInExpression,
  isExpressionUnsupported,
  matchExpressionByName,
  negateExpression,
  sanitiseExpression,
} from "@rilldata/web-common/features/dashboards/stores/filter-utils";
import { convertExpressionToFilterParam } from "@rilldata/web-common/features/dashboards/url-state/filters/converters";
import type {
  MetricsViewSpecDimension,
  V1Expression,
} from "@rilldata/web-common/runtime-client";
import {
  type MetricsViewSpecMeasure,
  V1Operation,
} from "@rilldata/web-common/runtime-client";
import {
  derived,
  get,
  type Readable,
  writable,
  type Writable,
} from "svelte/store";

export class Filters {
  private spec: CanvasResolvedSpec;
  // -------------------
  // STORES (writable)
  // -------------------
  whereFilter: Writable<V1Expression>;
  dimensionsWithInlistFilter: Writable<string[]>;
  dimensionThresholdFilters: Writable<Array<DimensionThresholdFilter>>;
  dimensionFilterExcludeMode: Writable<Map<string, boolean>>;
  temporaryFilterName: Writable<string | null>;

  // -------------------
  // "SELECTORS" (readable/derived)
  // -------------------
  measureHasFilter: Readable<(measureName: string) => boolean>;
  getAllMeasureFilterItems: Readable<
    (
      measureFilterItems: MeasureFilterItem[],
      measureIdMap: Map<string, MetricsViewSpecMeasure>,
    ) => MeasureFilterItem[]
  >;
  getMeasureFilterItems: Readable<
    (measureIdMap: Map<string, MetricsViewSpecMeasure>) => MeasureFilterItem[]
  >;

  getAllDimensionFilterItems: Readable<
    (
      dimensionFilterItems: DimensionFilterItem[],
      dimensionIdMap: Map<string, MetricsViewSpecDimension>,
    ) => DimensionFilterItem[]
  >;
  selectedDimensionValues: Readable<(dimName: string) => string[]>;
  atLeastOneSelection: Readable<(dimName: string) => boolean>;
  isFilterExcludeMode: Readable<(dimName: string) => boolean>;
  dimensionHasFilter: Readable<(dimName: string) => boolean>;
  getWhereFilterExpression: Readable<
    (name: string) => V1Expression | undefined
  >;
  getWhereFilterExpressionIndex: Readable<(name: string) => number | undefined>;
  getDimensionFilterItems: Readable<
    (
      dimensionIdMap: Map<string, MetricsViewSpecDimension>,
    ) => DimensionFilterItem[]
  >;
  unselectedDimensionValues: Readable<
    (dimensionName: string, values: unknown[]) => unknown[]
  >;
  includedDimensionValues: Readable<(dimensionName: string) => unknown[]>;
  hasAtLeastOneDimensionFilter: Readable<() => boolean>;
  filterText: Readable<string>;

  constructor(spec: CanvasResolvedSpec) {
    // -----------------------------
    // Initialize writable stores
    // -----------------------------
    this.spec = spec;
    this.dimensionFilterExcludeMode = writable(new Map<string, boolean>());
    this.temporaryFilterName = writable(null);
    this.whereFilter = writable({
      cond: {
        op: "OPERATION_AND",
        exprs: [],
      },
    });
    this.dimensionsWithInlistFilter = writable([]);
    this.dimensionThresholdFilters = writable([]);

    // -------------------------------
    // MEASURE SELECTORS
    // -------------------------------
    this.measureHasFilter = derived(
      this.dimensionThresholdFilters,
      ($dimensionThresholdFilters) => {
        return (measureName: string) => {
          return $dimensionThresholdFilters.some((dtf) =>
            dtf.filters.some((f) => f.measure === measureName),
          );
        };
      },
    );

    this.getAllMeasureFilterItems = derived(
      this.temporaryFilterName,
      (tempFilter) => {
        return (
          measureFilterItems: MeasureFilterItem[],
          measureIdMap: Map<string, MetricsViewSpecMeasure>,
        ) => {
          const itemsCopy = [...measureFilterItems];
          if (tempFilter && measureIdMap.has(tempFilter)) {
            const dimensions = spec.getDimensionsFromMeasure(tempFilter);
            itemsCopy.push({
              dimensionName: "",
              name: tempFilter,
              label: getMeasureDisplayName(measureIdMap.get(tempFilter)),
              dimensions: dimensions,
            });
          }
          return itemsCopy;
        };
      },
    );

    this.getMeasureFilterItems = derived(
      this.dimensionThresholdFilters,
      ($dimensionThresholdFilters) => {
        return (measureIdMap: Map<string, MetricsViewSpecMeasure>) => {
          return this.getMeasureFilters(
            measureIdMap,
            $dimensionThresholdFilters,
          );
        };
      },
    );

    // -------------------------------
    // DIMENSION SELECTORS
    // -------------------------------
    this.getAllDimensionFilterItems = derived(
      this.temporaryFilterName,
      (tempFilter) => {
        return (
          dimensionFilterItems: DimensionFilterItem[],
          dimensionIdMap: Map<string, MetricsViewSpecDimension>,
        ) => {
          const merged = [...dimensionFilterItems];
          if (tempFilter && dimensionIdMap.has(tempFilter)) {
            const metricsViewNames =
              spec.getMetricsViewNamesForDimension(tempFilter);
            merged.push({
              mode: DimensionFilterMode.Select,
              name: tempFilter,
              label: getDimensionDisplayName(dimensionIdMap.get(tempFilter)),
              selectedValues: [],
              isInclude: true,
              metricsViewNames,
            });
          }
          return merged.sort(filterItemsSortFunction);
        };
      },
    );

    this.selectedDimensionValues = derived(this.whereFilter, ($whereFilter) => {
      return (dimName: string) => {
        if (isExpressionUnsupported($whereFilter)) return [];
        // find the filter expression for this dimension
        const expr = $whereFilter.cond?.exprs?.find((e) =>
          matchExpressionByName(e, dimName),
        );
        return [...new Set(getValuesInExpression(expr) as string[])];
      };
    });

    this.atLeastOneSelection = derived(
      this.selectedDimensionValues,
      (fnSelectedDimensionValues) => {
        return (dimName: string) => {
          return fnSelectedDimensionValues(dimName).length > 0;
        };
      },
    );

    this.isFilterExcludeMode = derived(
      this.dimensionFilterExcludeMode,
      ($excludeMode) => {
        return (dimName: string) => {
          return $excludeMode.get(dimName) ?? false;
        };
      },
    );

    this.dimensionHasFilter = derived(this.whereFilter, ($whereFilter) => {
      return (dimName: string) => {
        return (
          $whereFilter.cond?.exprs?.find((e) =>
            matchExpressionByName(e, dimName),
          ) !== undefined
        );
      };
    });

    this.getWhereFilterExpression = derived(
      this.whereFilter,
      ($whereFilter) => {
        return (name: string) => {
          return $whereFilter.cond?.exprs?.find((e) =>
            matchExpressionByName(e, name),
          );
        };
      },
    );

    this.getWhereFilterExpressionIndex = derived(
      this.whereFilter,
      ($whereFilter) => {
        return (name: string) => {
          return $whereFilter.cond?.exprs?.findIndex((e) =>
            matchExpressionByName(e, name),
          );
        };
      },
    );

    this.getDimensionFilterItems = derived(
      [this.whereFilter, this.dimensionsWithInlistFilter],
      ([$whereFilter, $dimensionsWithInlistFilter]) => {
        return (dimensionIdMap: Map<string, MetricsViewSpecDimension>) => {
          const dimensionFilters = getDimensionFilters(
            dimensionIdMap,
            $whereFilter,
            $dimensionsWithInlistFilter,
          );
          dimensionFilters.forEach((dimensionFilter) => {
            dimensionFilter.metricsViewNames =
              spec.getMetricsViewNamesForDimension(dimensionFilter.name);
          });
          return dimensionFilters;
        };
      },
    );

    this.unselectedDimensionValues = derived(
      this.whereFilter,
      ($whereFilter) => {
        return (dimensionName: string, values: unknown[]) => {
          const expr = $whereFilter.cond?.exprs?.find((e) =>
            matchExpressionByName(e, dimensionName),
          );
          if (!expr) return values;
          return values.filter(
            (v) => expr.cond?.exprs?.findIndex((e) => e.val === v) === -1,
          );
        };
      },
    );

    this.includedDimensionValues = derived(this.whereFilter, ($whereFilter) => {
      return (dimensionName: string) => {
        const expr = $whereFilter.cond?.exprs?.find((e) =>
          matchExpressionByName(e, dimensionName),
        );
        if (!expr || expr.cond?.op !== V1Operation.OPERATION_IN) {
          return [];
        }
        return getValuesInExpression(expr);
      };
    });

    this.hasAtLeastOneDimensionFilter = derived(
      this.whereFilter,
      ($whereFilter) => {
        return () => {
          return !!(
            $whereFilter.cond?.exprs?.length &&
            $whereFilter.cond.exprs.length > 0
          );
        };
      },
    );

    this.filterText = derived(
      [
        this.whereFilter,
        this.dimensionThresholdFilters,
        this.dimensionsWithInlistFilter,
      ],
      ([$whereFilter, $dtf, $dimensionsWithInlistFilter]) => {
        const mergedFilters =
          sanitiseExpression(
            mergeDimensionAndMeasureFilters(
              $whereFilter ?? createAndExpression([]),
              $dtf,
            ),
            undefined,
          ) ?? createAndExpression([]);

        return convertExpressionToFilterParam(
          mergedFilters,
          $dimensionsWithInlistFilter,
        );
      },
    );
  }

  private getMeasureFilters = (
    measureIdMap: Map<string, MetricsViewSpecMeasure>,
    dimensionThresholdFilters: DimensionThresholdFilter[],
  ): MeasureFilterItem[] => {
    const filteredMeasures: MeasureFilterItem[] = [];
    const addedMeasure = new Set<string>();
    for (const dtf of dimensionThresholdFilters) {
      filteredMeasures.push(
        ...this.getMeasureFilterForDimension(
          measureIdMap,
          dtf.filters,
          dtf.name,
          addedMeasure,
        ),
      );
    }
    return filteredMeasures;
  };

  private getMeasureFilterForDimension = (
    measureIdMap: Map<string, MetricsViewSpecMeasure>,
    filters: MeasureFilterEntry[],
    name: string,
    addedMeasure: Set<string>,
  ): MeasureFilterItem[] => {
    if (!filters.length) return [];
    const filteredMeasures: MeasureFilterItem[] = [];
    filters.forEach((filter) => {
      if (addedMeasure.has(filter.measure)) return;
      const measure = measureIdMap.get(filter.measure);
      if (!measure) return;
      const dimensions = this.spec.getDimensionsFromMeasure(filter.measure);
      addedMeasure.add(filter.measure);
      filteredMeasures.push({
        dimensionName: name,
        name: filter.measure,
        label: measure.displayName || measure.expression || filter.measure,
        filter,
        dimensions,
      });
    });
    return filteredMeasures;
  };

  // --------------------
  // ACTIONS / MUTATORS
  // --------------------

  setMeasureFilter = (dimensionName: string, filter: MeasureFilterEntry) => {
    const tempFilter = get(this.temporaryFilterName);
    if (tempFilter !== null) {
      this.temporaryFilterName.set(null);
    }

    const dtfs = get(this.dimensionThresholdFilters);
    let dimThresholdFilter = dtfs.find((dtf) => dtf.name === dimensionName);
    if (!dimThresholdFilter) {
      dimThresholdFilter = { name: dimensionName, filters: [] };
      dtfs.push(dimThresholdFilter);
    }
    const exprIdx = dimThresholdFilter.filters.findIndex(
      (f) => f.measure === filter.measure,
    );
    if (exprIdx === -1) {
      dimThresholdFilter.filters.push(filter);
    } else {
      dimThresholdFilter.filters.splice(exprIdx, 1, filter);
    }
    this.dimensionThresholdFilters.set(dtfs);
  };

  removeMeasureFilter = (dimensionName: string, measureName: string) => {
    const tempFilter = get(this.temporaryFilterName);
    if (tempFilter === measureName) {
      this.temporaryFilterName.set(null);
      return;
    }
    const dtfs = get(this.dimensionThresholdFilters);
    const dimIdx = dtfs.findIndex((dtf) => dtf.name === dimensionName);
    if (dimIdx === -1) return;
    const filters = dtfs[dimIdx].filters;
    const exprIdx = filters.findIndex((f) => f.measure === measureName);
    if (exprIdx === -1) return;
    filters.splice(exprIdx, 1);
    if (!filters.length) {
      dtfs.splice(dimIdx, 1);
    }
    this.dimensionThresholdFilters.set(dtfs);
  };

  toggleDimensionValueSelection = (
    dimensionName: string,
    dimensionValue: string,
    keepPillVisible?: boolean,
    isExclusiveFilter?: boolean,
  ) => {
    const tempFilter = get(this.temporaryFilterName);
    if (tempFilter !== null) {
      this.temporaryFilterName.set(null);
    }
    const excludeMode = get(this.dimensionFilterExcludeMode);
    const isExclude = !!excludeMode.get(dimensionName);
    const wf = get(this.whereFilter);

    // Use the derived selector:
    const exprIndex = get(this.getWhereFilterExpressionIndex)(dimensionName);

    if (exprIndex === undefined || exprIndex === -1) {
      wf.cond?.exprs?.push(
        createInExpression(dimensionName, [dimensionValue], isExclude),
      );
      this.whereFilter.set(wf);
      return;
    }

    const expr = wf.cond?.exprs?.[exprIndex];
    if (!expr?.cond?.exprs) return;
    this.dimensionsWithInlistFilter.update((dimensionsWithInlistFilter) =>
      dimensionsWithInlistFilter.filter((d) => d !== dimensionName),
    );
    if (
      expr.cond?.op === V1Operation.OPERATION_LIKE ||
      expr.cond?.op === V1Operation.OPERATION_NLIKE
    ) {
      wf.cond?.exprs?.push(
        createInExpression(dimensionName, [dimensionValue], isExclude),
      );
      this.whereFilter.set(wf);
      return;
    }

    const inIdx = getValueIndexInExpression(expr, dimensionValue) as number;
    if (inIdx === -1) {
      if (isExclusiveFilter) {
        expr.cond.exprs.splice(1, expr.cond.exprs.length - 1, {
          val: dimensionValue,
        });
      } else {
        expr.cond.exprs.push({ val: dimensionValue });
      }
    } else {
      expr.cond.exprs.splice(inIdx, 1);
      if (expr.cond.exprs.length === 1) {
        wf.cond?.exprs?.splice(exprIndex, 1);
        if (keepPillVisible) {
          this.temporaryFilterName.set(dimensionName);
        }
      }
    }
    this.whereFilter.set(wf);
  };

  applyDimensionInListMode = (dimensionName: string, values: string[]) => {
    const tempFilter = get(this.temporaryFilterName);
    if (tempFilter !== null) {
      this.temporaryFilterName.set(null);
    }
    const excludeMode = get(this.dimensionFilterExcludeMode);
    const isExclude = !!excludeMode.get(dimensionName);
    const wf = get(this.whereFilter);

    const expr = createInExpression(dimensionName, values, isExclude);
    this.dimensionsWithInlistFilter.update((dimensionsWithInlistFilter) => {
      return [...dimensionsWithInlistFilter, dimensionName];
    });

    const exprIndex = get(this.getWhereFilterExpressionIndex)(dimensionName);
    if (exprIndex === undefined || exprIndex === -1) {
      wf.cond!.exprs!.push(expr);
    } else {
      wf.cond!.exprs![exprIndex] = expr;
    }
    this.whereFilter.set(wf);
  };

  applyDimensionContainsMode = (dimensionName: string, searchText: string) => {
    const tempFilter = get(this.temporaryFilterName);
    if (tempFilter !== null) {
      this.temporaryFilterName.set(null);
    }
    const excludeMode = get(this.dimensionFilterExcludeMode);
    const isExclude = !!excludeMode.get(dimensionName);
    const wf = get(this.whereFilter);

    const expr = createLikeExpression(
      dimensionName,
      `%${searchText}%`,
      isExclude,
    );
    const exprIndex = get(this.getWhereFilterExpressionIndex)(dimensionName);
    if (exprIndex === undefined || exprIndex === -1) {
      wf.cond!.exprs!.push(expr);
    } else {
      wf.cond!.exprs![exprIndex] = expr;
    }
    this.whereFilter.set(wf);
  };

  toggleDimensionFilterMode = (dimensionName: string) => {
    const excludeMode = get(this.dimensionFilterExcludeMode);
    const newExclude = !excludeMode.get(dimensionName);
    excludeMode.set(dimensionName, newExclude);
    this.dimensionFilterExcludeMode.set(excludeMode);

    const wf = get(this.whereFilter);
    if (!wf.cond?.exprs) return;
    const exprIdx = wf.cond.exprs.findIndex(
      (e) => e.cond?.exprs?.[0].ident === dimensionName,
    );
    if (exprIdx === -1) return;
    wf.cond.exprs[exprIdx] = negateExpression(wf.cond.exprs[exprIdx]);
    this.whereFilter.set(wf);
  };

  removeDimensionFilter = (dimensionName: string) => {
    const tempFilter = get(this.temporaryFilterName);
    if (tempFilter === dimensionName) {
      this.temporaryFilterName.set(null);
      return;
    }
    const wf = get(this.whereFilter);
    const exprIdx = get(this.getWhereFilterExpressionIndex)(dimensionName);
    if (exprIdx === undefined || exprIdx === -1) return;
    wf.cond?.exprs?.splice(exprIdx, 1);
    this.whereFilter.set(wf);
  };

  selectItemsInFilter = (dimensionName: string, values: (string | null)[]) => {
    const excludeMode = get(this.dimensionFilterExcludeMode);
    const isExclude = !!excludeMode.get(dimensionName);
    const wf = get(this.whereFilter);
    const exprIdx = get(this.getWhereFilterExpressionIndex)(dimensionName);
    if (exprIdx === undefined || exprIdx === -1) {
      wf.cond?.exprs?.push(
        createInExpression(dimensionName, values, isExclude),
      );
      this.whereFilter.set(wf);
      return;
    }
    const expr = wf.cond?.exprs?.[exprIdx];
    if (!expr?.cond?.exprs) return;
    const oldValues = getValuesInExpression(expr);
    const newValues = values.filter((v) => !oldValues.includes(v));
    expr.cond.exprs.push(...newValues.map((v) => ({ val: v })));
    this.whereFilter.set(wf);
  };

  deselectItemsInFilter = (
    dimensionName: string,
    values: (string | null)[],
  ) => {
    const wf = get(this.whereFilter);
    const exprIdx = get(this.getWhereFilterExpressionIndex)(dimensionName);
    if (exprIdx === undefined || exprIdx === -1) return;
    const expr = wf.cond?.exprs?.[exprIdx];
    if (!expr?.cond?.exprs) return;
    const oldValues = getValuesInExpression(expr);
    const newValues = oldValues.filter((v) => !values.includes(v));
    if (newValues.length) {
      expr.cond.exprs.splice(
        1,
        expr.cond.exprs.length - 1,
        ...newValues.map((v) => ({ val: v })),
      );
    } else {
      wf.cond?.exprs?.splice(exprIdx, 1);
    }
    this.whereFilter.set(wf);
  };

  setFilters = (filter: V1Expression) => {
    const { dimensionFilters, dimensionThresholdFilters } =
      splitWhereFilter(filter);
    this.whereFilter.set(dimensionFilters);
    this.dimensionThresholdFilters.set(dimensionThresholdFilters);
  };

  clearAllFilters = () => {
    const wf = get(this.whereFilter);
    const dtfs = get(this.dimensionThresholdFilters);
    const hasFilters = wf.cond?.exprs?.length || dtfs.length;
    if (!hasFilters) return;
    this.whereFilter.set(createAndExpression([]));
    this.dimensionThresholdFilters.set([]);
    this.temporaryFilterName.set(null);
    const excludeMode = get(this.dimensionFilterExcludeMode);
    excludeMode.clear();
    this.dimensionFilterExcludeMode.set(excludeMode);
  };

  setTemporaryFilterName = (name: string) => {
    this.temporaryFilterName.set(name);
  };

  setFiltersFromText = (filterText: string) => {
    const { expr, dimensionsWithInlistFilter } = getFiltersFromText(filterText);
    this.setFilters(expr);
    this.dimensionsWithInlistFilter.set(dimensionsWithInlistFilter);
  };
}
