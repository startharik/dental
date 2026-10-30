import { useMutation, useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/axios";
import type {
  ResearchAnalysisRequest,
  ResearchAnalysisResponse,
  ResearchModeStatus,
} from "@/lib/types";

export function useResearchModeStatus() {
  return useQuery({
    queryKey: ["research-mode-status"],
    queryFn: async () => {
      const response =
        await apiClient.get<ResearchModeStatus>("/research-mode");
      return response.data;
    },
    staleTime: 60_000,
  });
}

export function useGenerateResearchAnalysis() {
  return useMutation<ResearchAnalysisResponse, Error, ResearchAnalysisRequest>({
    mutationFn: async (request) => {
      const response = await apiClient.post<ResearchAnalysisResponse>(
        "/research-analysis",
        request
      );
      return response.data;
    },
  });
}
