<script lang="ts">
  import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@rilldata/web-common/components/alert-dialog/index.js";
  import { Button } from "@rilldata/web-common/components/button/index.js";

  export let open = false;
  export let id: string;
  export let onDelete: (id: string) => void;

  async function handleDelete() {
    try {
      onDelete(id);
      open = false;
    } catch (error) {
      console.error("Failed to delete public URL:", error);
    }
  }
</script>

<AlertDialog bind:open>
  <AlertDialogTrigger asChild>
    <div class="hidden"></div>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete this public URL?</AlertDialogTitle>
      <AlertDialogDescription>
        <div class="mt-1">
          Recipients of this URL will no longer be able to access it.
        </div>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <Button
        type="plain"
        onClick={() => {
          open = false;
        }}>Cancel</Button
      >
      <Button type="primary" status="error" onClick={handleDelete}
        >Yes, delete</Button
      >
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
