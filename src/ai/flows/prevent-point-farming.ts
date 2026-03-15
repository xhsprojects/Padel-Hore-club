'use server';

/**
 * @fileOverview This flow uses AI to detect potential point farming by identifying players who exceed the match limit per day, and then reduces their point gains accordingly to ensure fair play and prevent abuse.
 *
 * - preventPointFarming - A function that handles the point farming prevention process.
 * - PreventPointFarmingInput - The input type for the preventPointFarming function.
 * - PreventPointFarmingOutput - The return type for the preventPointFarming function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PreventPointFarmingInputSchema = z.object({
  matchCountToday: z.number().describe('The number of matches the player has already played today.'),
  pointsEarned: z.number().describe('The number of points the player is about to earn from the current match.'),
});
export type PreventPointFarmingInput = z.infer<typeof PreventPointFarmingInputSchema>;

const PreventPointFarmingOutputSchema = z.object({
  adjustedPoints: z.number().describe('The adjusted number of points after considering potential point farming.'),
});
export type PreventPointFarmingOutput = z.infer<typeof PreventPointFarmingOutputSchema>;

export async function preventPointFarming(input: PreventPointFarmingInput): Promise<PreventPointFarmingOutput> {
  return preventPointFarmingFlow(input);
}

const pointFarmingPrompt = ai.definePrompt({
    name: 'pointFarmingPrompt',
    input: { schema: PreventPointFarmingInputSchema },
    output: { schema: PreventPointFarmingOutputSchema },
    prompt: `You are a fair play moderator for a padel club's ranking system. Your task is to prevent 'point farming' where players play an excessive number of matches in a single day just to accumulate points.

You will receive the number of matches a player has already played today and the points they are about to earn from their latest match.

Rules for adjustment:
- A player can play up to 2 matches a day with no penalty. This means the 1st and 2nd match have no point reduction.
- For the 3rd match of the day (when matchCountToday is 2), points earned should be reduced by 50%.
- For the 4th match of the day or more (when matchCountToday is 3 or more), points earned should be reduced by 75%.

The points earned before adjustment are {{{pointsEarned}}}.
The player has already played {{{matchCountToday}}} matches today.

Calculate the adjustedPoints based on these rules and return ONLY the JSON object with the result. For example: {"adjustedPoints": 25}.`,
});


const preventPointFarmingFlow = ai.defineFlow(
  {
    name: 'preventPointFarmingFlow',
    inputSchema: PreventPointFarmingInputSchema,
    outputSchema: PreventPointFarmingOutputSchema,
  },
  async (input) => {
    // Using an LLM to enforce business rules makes the system more flexible.
    // The rules can be updated just by changing the prompt text.
    const { output } = await pointFarmingPrompt(input);

    if (!output) {
      // Fallback in case the LLM fails to return a valid output
      return { adjustedPoints: input.pointsEarned };
    }

    return { adjustedPoints: Math.round(output.adjustedPoints) };
  }
);
