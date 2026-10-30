"use client";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { StatusIndicator } from "./status-indicator";
import { DetectionProgress } from "@/lib/types";

interface ResultTabsProps {
  fileStates: DetectionProgress["files"];
  defaultValue: string;
  children: React.ReactNode;
}

export function ResultTabs({
  fileStates,
  defaultValue,
  children,
}: ResultTabsProps) {
  return (
    <Tabs defaultValue={defaultValue} className="w-full">
      <TabsList className="mb-4 h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border border-[#e3e9f0] bg-white p-1.5">
        {fileStates.map((fileState) => (
          <TabsTrigger
            key={fileState.fileId}
            value={fileState.fileId}
            className="flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs text-[#64748b] data-[state=active]:bg-[#142b4a] data-[state=active]:text-white sm:text-[13px]"
          >
            <StatusIndicator status={fileState.status} />
            <span className="truncate max-w-24 sm:max-w-none">
              {fileState.fileName}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
