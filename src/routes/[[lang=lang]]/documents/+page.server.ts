import { PUBLIC_BUCKETS_DOCUMENTS } from "$env/static/public";
import { fileHandler } from "$lib/files";
import type { FileData } from "$lib/files/fileHandler.js";
import { error, fail } from "@sveltejs/kit";
import { message, superValidate } from "sveltekit-superforms/server";
import { z } from "zod";
import type { Actions, PageServerLoad } from "./$types";

export type DocumentType =
  | "board-meeting"
  | "guild-meeting"
  | "SRD-meeting"
  | "other";
const prefixByType: Record<DocumentType, string> = {
  "board-meeting": "S",
  "guild-meeting": "",
  "SRD-meeting": "Möte ",
  other: "",
};
export const load: PageServerLoad = async ({ locals, url }) => {
  const { user } = locals;
  const year = url.searchParams.get("year") || new Date().getFullYear();
  const type: DocumentType =
    (url.searchParams.get("type") as DocumentType) || "board-meeting";
  const files = await fileHandler.getInBucket(
    user,
    PUBLIC_BUCKETS_DOCUMENTS,
    year + "/" + (prefixByType[type] ?? ""),
    true,
  );
  const srdFiles = await fileHandler.getInBucket(
    user,
    PUBLIC_BUCKETS_DOCUMENTS,
    "srd/" + year,
    true,
  );
  if (!files) throw error(404, "No files found");
  let filteredFiles = files;
  switch (type) {
    case "guild-meeting":
      filteredFiles = files.filter((file) => {
        const fileParts = file.id.split("/");
        const meeting = fileParts[fileParts.length - 2] ?? "unknown";
        return meeting.startsWith("HTM") || meeting.startsWith("VTM");
      });
      break;

    case "SRD-meeting":
      filteredFiles = srdFiles;
      break;

    case "other":
      filteredFiles = files.filter((file) => {
        const fileParts = file.id.split("/");
        const meeting = fileParts[fileParts.length - 2] ?? "unknown";
        return (
          !meeting.startsWith("HTM") &&
          !meeting.startsWith("VTM") &&
          !meeting.startsWith("S") &&
          meeting != year
        );
      });
      break;
  }
  const filesGroupedByMeeting = filteredFiles.reduce<
    Record<string, FileData[]>
  >((acc, file) => {
    const fileParts = file.id.split("/");
    const meeting = fileParts[fileParts.length - 2] ?? "unknown";
    if (!acc[meeting]) acc[meeting] = [];
    acc[meeting]!.push(file);
    return acc;
  }, {});
  return {
    files,
    meetings: filesGroupedByMeeting,
    deleteForm: await superValidate(deleteSchema),
  };
};

const deleteSchema = z.object({
  id: z.string(),
});
export type DeleteSchema = typeof deleteSchema;

export const actions: Actions = {
  deleteFile: async ({ request, locals }) => {
    const { user } = locals;
    const form = await superValidate(request, deleteSchema);
    if (!form.valid) return fail(400, { form });
    const { id } = form.data;
    await fileHandler.remove(user, PUBLIC_BUCKETS_DOCUMENTS, [id]);
    return message(form, {
      message: "Fil borttagen",
      type: "success",
    });
  },
};
