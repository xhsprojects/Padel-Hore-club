'use server';

/**
 * @fileOverview This flow uses AI to suggest balanced teams for a padel match.
 *
 * - suggestTeams - A function that takes four players and suggests two balanced teams.
 * - Player - The simplified player type for the AI prompt.
 * - SuggestTeamsInput - The input type for the suggestTeams function.
 * - SuggestTeamsOutput - The return type for the suggestTeams function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Simplified UserProfile for the AI prompt context
const PlayerSchema = z.object({
  id: z.string().describe("The player's unique ID."),
  name: z.string().describe("The player's name."),
  tier: z.string().describe("The player's current skill tier (e.g., beginner, bronze, silver, gold)."),
  total_points: z.number().describe("The player's total accumulated points."),
  win_rate: z.number().describe("The player's win rate percentage (0-100)."),
});
export type Player = z.infer<typeof PlayerSchema>;

const SuggestTeamsInputSchema = z.object({
  players: z.array(PlayerSchema).length(4).describe('An array of exactly four players to be sorted into two teams.'),
});
export type SuggestTeamsInput = z.infer<typeof SuggestTeamsInputSchema>;

const SuggestTeamsOutputSchema = z.object({
  team1_player_ids: z.array(z.string()).length(2).describe('An array containing the IDs of the two players for Team 1.'),
  team2_player_ids: z.array(z.string()).length(2).describe('An array containing the IDs of the two players for Team 2.'),
  explanation: z.string().describe('A brief explanation of why the teams were balanced this way.'),
});
export type SuggestTeamsOutput = z.infer<typeof SuggestTeamsOutputSchema>;

export async function suggestTeams(input: SuggestTeamsInput): Promise<SuggestTeamsOutput> {
  return suggestTeamsFlow(input);
}

const suggestTeamsPrompt = ai.definePrompt({
  name: 'suggestTeamsPrompt',
  input: { schema: SuggestTeamsInputSchema },
  output: { schema: SuggestTeamsOutputSchema },
  prompt: `You are an expert padel match organizer. Your task is to create two balanced teams of two from the four players provided.

Analyze the players based on their tier, total points, and win rate. The goal is to make the match as competitive and fair as possible.

- Try to balance the total points between the two teams.
- Avoid putting the two strongest players on the same team.
- A good strategy is often to pair the strongest player with the weakest player, and the two middle players together.

Here are the players:
{{#each players}}
- Player ID: {{{id}}}, Name: {{{name}}}, Tier: {{{tier}}}, Points: {{{total_points}}}, Win Rate: {{{win_rate}}}%
{{/each}}

Based on your analysis, provide the two teams and a brief, one-sentence explanation for your decision. For example: "Team 1 has a slightly higher average, but Team 2 has a more consistent player, making it a balanced matchup."

Return ONLY the JSON object with the team IDs and your explanation.`,
});

const suggestTeamsFlow = ai.defineFlow(
  {
    name: 'suggestTeamsFlow',
    inputSchema: SuggestTeamsInputSchema,
    outputSchema: SuggestTeamsOutputSchema,
  },
  async (input) => {
    const { output } = await suggestTeamsPrompt(input);
    if (!output) {
      throw new Error('The AI failed to suggest teams.');
    }
    return output;
  }
);
