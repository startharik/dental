"use client";

import { toast } from "sonner";
import { useResearchModeStatus } from "@/hooks/use-research-analysis";
import { useResearchAutoPreference } from "@/hooks/use-research-auto-preference";

export function ResearchAutoPreference() {
  const researchModeStatus = useResearchModeStatus();
  const preference = useResearchAutoPreference();
  const isResearchReady = researchModeStatus.data?.enabled;

  return (
    <div className="rounded-xl border border-[#d9e7ee] bg-[#f7fbfd] p-3">
      <label className="flex items-start gap-2 text-xs font-semibold text-[#142b4a]">
        <input
          type="checkbox"
          checked={preference.enabled}
          disabled={!preference.loaded || !isResearchReady}
          onChange={(event) => {
            const saved = preference.updatePreference(event.target.checked);
            if (!saved) {
              toast.error(
                "The automatic research preference could not be saved in this browser."
              );
            }
          }}
          className="mt-0.5 size-4 shrink-0 accent-[#168a86]"
        />
        <span>Automatically analyze completed studies with LePro AI</span>
      </label>
      <p className="mt-1 pl-6 text-[10px] leading-4 text-[#61758b]">
        When enabled, completed radiographs and model findings are sent for
        LePro AI analysis. Use de-identified or demo images.
      </p>
      {preference.storageError && (
        <p role="alert" className="mt-1 pl-6 text-[10px] text-[#9f3434]">
          Browser storage is unavailable, so this preference cannot be saved.
        </p>
      )}
      {!researchModeStatus.isLoading && !isResearchReady && (
        <p className="mt-1 pl-6 text-[10px] text-[#9f3434]">
          LePro AI analysis is not available for this instance.
        </p>
      )}
    </div>
  );
}
