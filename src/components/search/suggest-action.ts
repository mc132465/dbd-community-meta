"use server";

import {
  searchSuggestions,
  type SearchSuggestion,
} from "@/lib/services/search.service";

export async function suggestAction(query: string): Promise<SearchSuggestion[]> {
  return searchSuggestions(query);
}
