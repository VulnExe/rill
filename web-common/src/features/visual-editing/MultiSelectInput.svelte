<script lang="ts">
  import FieldSwitcher from "@rilldata/web-common/components/forms/FieldSwitcher.svelte";
  import InputLabel from "@rilldata/web-common/components/forms/InputLabel.svelte";
  import SelectionDropdown from "./SelectionDropdown.svelte";

  export let defaultItems: string[];
  export let searchableItems: string[] | undefined = undefined;
  export let selectedItems: Set<string>;
  export let keyNotSet: boolean;
  export let label: string;
  export let id: string;
  export let hint: string | undefined = undefined;
  export let defaultLabel = "default";
  export let noneOption = false;
  export let showLabel = true;
  export let small = false;
  export let onSelectCustomItem: (item: string) => void;
  export let setItems: (timeRanges: string[]) => void;
  export let clearKey: () => void = () => {};

  const defaultSet = new Set(defaultItems);

  let hasDefaultsSelected =
    (keyNotSet && !noneOption) ||
    (defaultSet.size === selectedItems.size &&
      defaultSet.isSubsetOf(selectedItems));

  let selected: 0 | 1 | 2 = hasDefaultsSelected
    ? 0
    : keyNotSet && noneOption
      ? 2
      : 1;

  let selectedProxy = new Set(selectedItems);

  $: if (keyNotSet && !noneOption) {
    selected = 0;
  } else if (keyNotSet && noneOption) {
    selected = 2;
  }
</script>

<div class="flex flex-col gap-y-1">
  {#if showLabel}
    <InputLabel {small} capitalize={false} {label} {id} {hint} />
  {/if}
  <FieldSwitcher
    {small}
    expand
    fields={[defaultLabel, "custom"].concat(noneOption ? ["none"] : [])}
    {selected}
    onClick={(_, field) => {
      if (field === "custom") {
        selected = 1;
        setItems(selectedProxy.size ? Array.from(selectedProxy) : defaultItems);
      } else if (field === defaultLabel) {
        selected = 0;
        setItems(defaultItems);
      } else if (field === "none") {
        selected = 2;
        clearKey();
      }
    }}
  />

  {#if selected === 1}
    <SelectionDropdown
      {small}
      {searchableItems}
      {id}
      allItems={defaultSet}
      {selectedItems}
      onSelect={(item) => {
        const deleted = selectedProxy.delete(item);
        if (!deleted) {
          selectedProxy.add(item);
        }

        selectedProxy = selectedProxy;

        onSelectCustomItem(item);
      }}
      setItems={(items) => {
        selectedProxy = new Set(items);
        setItems(items);
      }}
      let:item
      let:selected
      type={label.toLowerCase()}
    >
      <slot {item} {selected} />
    </SelectionDropdown>
  {/if}
</div>
