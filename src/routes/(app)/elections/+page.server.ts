import apiNames from "$lib/utils/apiNames";
import { isAuthorized } from "$lib/utils/authorization";

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  const { prisma, user } = locals;
  const openElections = await prisma.election.findMany({
    where: {
      expiresAt: {
        gte: new Date(),
      },
    },
    select: {
      markdown: true,
      markdownEn: true,
      link: true,
      expiresAt: true,
      committee: true,
    },
  });

  return {
    openElections,
  };
};
