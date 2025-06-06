<script lang="ts">
  import Button from "@rilldata/web-common/components/button/Button.svelte";
  import Input from "@rilldata/web-common/components/forms/Input.svelte";
  import Label from "@rilldata/web-common/components/forms/Label.svelte";
  import Switch from "@rilldata/web-common/components/forms/Switch.svelte";
  import InfoCircle from "@rilldata/web-common/components/icons/InfoCircle.svelte";
  import Tooltip from "@rilldata/web-common/components/tooltip/Tooltip.svelte";
  import TooltipContent from "@rilldata/web-common/components/tooltip/TooltipContent.svelte";
  import { NUMERICS } from "@rilldata/web-common/lib/duckdb-data-types";
  import { eventBus } from "@rilldata/web-common/lib/event-bus/event-bus";
  import { FormatPreset } from "@rilldata/web-common/lib/number-formatting/humanizer-types";
  import type { V1ProfileColumn } from "@rilldata/web-common/runtime-client";
  import { parseDocument, YAMLMap, YAMLSeq } from "yaml";
  import { FileArtifact } from "../entity-management/file-artifact";
  import { YAMLDimension, YAMLMeasure, type MenuOption } from "./lib";
  import SimpleSqlExpression from "./SimpleSQLExpression.svelte";

  export let item: YAMLMeasure | YAMLDimension;
  export let fileArtifact: FileArtifact;
  export let index: number;
  export let type: "measures" | "dimensions";
  export let columns: V1ProfileColumn[];
  export let editing: boolean;
  export let unsavedChanges: boolean;
  export let switchView: () => void;
  export let onDelete: () => void;
  export let onCancel: (unsavedChanges: boolean) => void;
  export let resetEditing: () => void;

  let editingClone = structuredClone(item);

  let columnOptions: MenuOption[] = columns.map(({ name, type }) => ({
    value: name ?? "",
    label: name ?? "",
    type,
  }));

  let properties: Record<
    string,
    Array<{
      label: string;
      selected: number;
      optional?: true;
      fontFamily?: string;
      fields: Array<{
        key: string;
        hint?: string;
        label: string;
        options?: MenuOption[];
        placeholder?: string;
        boolean?: true;
      }>;
    }>
  > = {
    measures: [
      {
        label: "SQL expression",
        fontFamily: `"Source Code Variable", monospace`,
        fields: [
          {
            key: "expression",
            label: "Simple",
            options: columnOptions,
            placeholder: "Column from model",
          },
          {
            key: "expression",
            label: "Advanced",
          },
        ],
        selected: editingClone.expression ? 1 : 0,
      },
      {
        label: "Name",
        fontFamily: `"Source Code Variable", monospace`,
        fields: [
          {
            key: "name",
            hint: "A stable identifier for use in code",
            label: "Name",
          },
        ],
        selected: 0,
      },
      {
        optional: true,
        label: "Display name",
        fields: [
          {
            key: "display_name",
            hint: "Used on dashboards and charts. Inferred from name when not provided",

            label: "Display name",
          },
        ],
        selected: 0,
      },
      {
        label: "Format",
        fields: [
          {
            label: "Simple",
            key: "format_preset",
            options: Object.values(FormatPreset).map((value) => ({
              value,
              label: value,
            })),
            placeholder: "Select a format",
          },
          {
            label: "d3-format",
            key: "format_d3",
          },
        ],
        selected: editingClone["format_d3"] ? 1 : 0,
      },
      {
        optional: true,
        label: "Description",
        fields: [
          {
            key: "description",

            label: "Description",
          },
        ],
        selected: 0,
      },
      {
        label: "Summable metric",
        optional: true,
        fields: [
          {
            key: "valid_percent_of_total",
            hint: "Values can be added to yield a valid sum",
            label: "Summable metric",
            boolean: true,
          },
        ],
        selected: 0,
      },
    ],
    dimensions: [
      {
        label: "SQL expression",
        fontFamily: `"Source Code Variable", monospace`,
        fields: [
          {
            placeholder: "Column from model",
            options: columnOptions,
            key: "column",
            label: "Simple",
          },
          {
            label: "Advanced",
            key: "expression",
          },
        ],
        selected: editingClone.expression ? 1 : 0,
      },
      {
        label: "Name",
        fontFamily: `"Source Code Variable", monospace`,
        fields: [
          {
            key: "name",
            hint: "A stable identifier for use in code",
            label: "Name",
          },
        ],
        selected: 0,
      },
      {
        label: "Display name",
        optional: true,
        fields: [
          {
            key: "display_name",
            hint: "Used on dashboards and charts. Inferred from name when not provided",

            label: "Display name",
          },
        ],
        selected: 0,
      },

      {
        label: "Description",
        optional: true,
        fields: [
          {
            key: "description",

            label: "Description",
          },
        ],
        selected: 0,
      },
    ],
  };

  $: numericColumns = columnOptions.filter(
    ({ type }) => type && NUMERICS.has(type),
  );

  $: ({ editorContent, updateEditorContent } = fileArtifact);

  $: requiredPropertiesUnfilled = properties[type]
    .filter(({ optional, fields, selected }) => {
      const value = editingClone[fields[selected].key];
      return !optional && (value === undefined || value === "");
    })
    .map(({ label }) => label);

  $: unsavedChanges = Object.keys(editingClone).some(
    (key) =>
      editingClone[key] !== item?.[key] ||
      (item?.["format_preset"] && item?.["format_d3"]),
  );

  async function saveChanges() {
    const parsedDocument = parseDocument($editorContent ?? "");
    let sequence = parsedDocument.get(type);

    if (!(sequence instanceof YAMLSeq) || sequence.items.length === 0) {
      sequence = new YAMLSeq();
      parsedDocument.set(type, sequence);
    }

    if (!(sequence instanceof YAMLSeq)) {
      throw new Error("Invalid YAML document");
    }

    const items = sequence.items as YAMLMap[];
    const newItem = items[index] ?? new YAMLMap();

    properties[type].forEach(({ selected, fields, label }) => {
      const { key } = fields[selected];
      if (label === "Format") {
        if (key === "format_preset") {
          newItem.delete("format_d3");
        } else {
          newItem.delete("format_preset");
        }
      } else if (label === "SQL expression" && type === "dimensions") {
        if (key === "expression") {
          newItem.delete("column");
        } else {
          newItem.delete("expression");
        }
      }

      if (editingClone[key] || editingClone[key] === false)
        newItem.set(key, editingClone[key]);
    });

    if (editing) {
      items[index] = newItem;
    } else {
      items.push(newItem);
    }

    await updateEditorContent(parsedDocument.toString(), false, true);

    resetEditing();

    eventBus.emit("notification", { message: "Item saved", type: "success" });
  }
</script>

<svelte:window
  on:keydown={(e) => {
    if (e.key === "Escape") onCancel(unsavedChanges);
  }}
/>

<div
  class="h-full w-[320px] bg-surface flex-none flex flex-col border select-none rounded-[2px]"
>
  <h1 class="pt-6 px-5">{editing ? "Edit" : "Add"} {type.slice(0, -1)}</h1>

  <div
    class="px-5 flex flex-col gap-y-3 w-full h-fit overflow-y-auto overflow-x-visible"
  >
    {#each properties[type] as { fields, selected, label, optional, fontFamily } (label)}
      {@const { hint, key, options, placeholder, boolean } = fields[selected]}

      {#if boolean}
        <div class="flex gap-x-2 items-center h-full rounded-full">
          <Switch bind:checked={editingClone[key]} id="auto-save" medium />
          <Label class="font-medium text-sm" for="auto-save">{label}</Label>
          {#if hint}
            <Tooltip location="left">
              <div class="text-gray-500">
                <InfoCircle size="13px" />
              </div>
              <TooltipContent slot="tooltip-content">
                {hint}
              </TooltipContent>
            </Tooltip>
          {/if}
        </div>
      {:else if key === "expression" && type === "measures"}
        <SimpleSqlExpression
          {editing}
          columns={columnOptions}
          {numericColumns}
          bind:expression={editingClone.expression}
          bind:name={editingClone.name}
        />
      {:else}
        <Input
          id="vme-{label}"
          textClass="text-sm"
          capitalizeLabel={false}
          {label}
          {hint}
          {options}
          {optional}
          {fontFamily}
          {placeholder}
          multiline={key === "description" || key === "expression"}
          enableSearch={key === "column"}
          {selected}
          bind:value={editingClone[key]}
          fields={fields.map(({ label }) => label)}
          onChange={(e) => {
            if (!editing && key === "column" && type === "dimensions") {
              editingClone.name = e;
            }
          }}
          onFieldSwitch={(index) => {
            selected = index;
          }}
          sameWidth={true}
        />
      {/if}
    {/each}

    <span />
  </div>

  <div class="flex flex-col gap-y-3 mt-auto border-t px-5 pb-6 pt-3">
    <p>
      For more options,
      <button on:click={switchView} class="text-primary-600 font-medium">
        edit in YAML
      </button>
    </p>
    <div class="flex justify-{editing ? 'between' : 'end'}">
      {#if editing}
        <Button type="text" onClick={onDelete}>Delete</Button>
      {/if}
      <div class="flex gap-x-2 self-end">
        <Button
          type="secondary"
          onClick={() => {
            onCancel(unsavedChanges);
          }}
        >
          Cancel
        </Button>
        <Tooltip
          location="top"
          distance={8}
          suppress={!requiredPropertiesUnfilled.length}
        >
          <Button
            type="primary"
            onClick={saveChanges}
            disabled={requiredPropertiesUnfilled.length > 0 || !unsavedChanges}
          >
            {editing ? "Save changes" : "Add " + type.slice(0, -1)}
          </Button>

          <TooltipContent slot="tooltip-content">
            Required: {requiredPropertiesUnfilled.join(", ")}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  </div>
</div>

<style lang="postcss">
  h1 {
    @apply text-lg font-semibold mb-4;
  }

  /* h2 {
    @apply text-sm font-medium;
  } */
</style>
