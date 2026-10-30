"use client";

import { useState } from "react";
import {
  Activity,
  FileImage,
  LayoutDashboard,
  Menu,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import { DicomDropzone } from "@/components/dicom/dicom-dropzone";
import { PredictionResults } from "@/components/results/prediction-results";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDicomDetection } from "@/hooks/use-dicom-detection";
import { useDroppedFilesStore } from "@/lib/store";

type WorkspaceScreen = "new-analysis" | "analysis-workspace";

const navigationItems: {
  label: string;
  screen: WorkspaceScreen;
  icon: typeof LayoutDashboard;
}[] = [
  { label: "New Analysis", screen: "new-analysis", icon: ScanLine },
  {
    label: "Analysis Workspace",
    screen: "analysis-workspace",
    icon: LayoutDashboard,
  },
];

export default function Home() {
  const [screen, setScreen] = useState<WorkspaceScreen>("new-analysis");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { files, clearFiles } = useDroppedFilesStore();
  const dicomDetectionMutation = useDicomDetection();
  const { detectionProgress, updateDiagnosticReport } = dicomDetectionMutation;
  const hasAnalysis = detectionProgress.files.length > 0;

  const handlePredict = () => {
    if (files.length === 0 || dicomDetectionMutation.isPending) return;

    dicomDetectionMutation.mutate(
      { files },
      { onSettled: () => setScreen("analysis-workspace") }
    );
  };

  const startNewAnalysis = () => {
    if (dicomDetectionMutation.isPending) return;
    clearFiles();
    dicomDetectionMutation.reset();
    setScreen("new-analysis");
    setIsMobileMenuOpen(false);
  };

  const navigateTo = (target: WorkspaceScreen) => {
    if (target === "new-analysis") {
      startNewAnalysis();
      return;
    }
    if (hasAnalysis) setScreen(target);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#172b45]">
      <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[#e3e9f0] bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-[#142b4a] text-[#54d3ca]">
            <Activity className="size-5" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight text-[#142b4a]">
              Dentra<span className="text-[#0e8f89]">AI</span>
            </span>
            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8291a7]">
              Dental intelligence
            </span>
          </span>
        </div>

        <div className="hidden items-center gap-2 text-sm text-[#64748b] sm:flex">
          <span>Imaging</span>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-[#142b4a]">
            {screen === "new-analysis" ? "New Analysis" : "Analysis Workspace"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu aria-hidden="true" />
              </Button>
            </DialogTrigger>
            <DialogContent className="fixed inset-y-0 left-0 h-dvh w-[min(18rem,calc(100vw-3rem))] max-w-none translate-x-0 translate-y-0 rounded-none border-y-0 border-l-0 border-r border-[#e3e9f0] p-0 data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left sm:max-w-none">
              <div className="flex h-full flex-col bg-white">
                <div className="border-b border-[#e3e9f0] px-5 pb-5 pt-7">
                  <DialogTitle className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#94a3b8]">
                    Dental imaging
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Navigate between a new analysis and its analysis workspace.
                  </DialogDescription>
                </div>
                <Navigation
                  activeScreen={screen}
                  hasAnalysis={hasAnalysis}
                  onNavigate={navigateTo}
                  mobile
                />
                <WorkspaceFooter />
              </div>
            </DialogContent>
          </Dialog>

          <span className="flex items-center gap-2 rounded-full border border-[#ccece8] bg-[#f1fbfa] px-3 py-1.5 text-xs font-medium text-[#0e7572]">
            <span className="size-2 rounded-full bg-[#14a69e]" />
            <span className="hidden sm:inline">Clinical workspace</span>
            <span className="sm:hidden">Workspace</span>
          </span>
        </div>
      </header>

      <aside className="fixed top-[68px] bottom-0 left-0 z-20 hidden w-[248px] border-r border-[#e3e9f0] bg-white lg:flex lg:flex-col">
        <div className="px-5 pb-3 pt-7 text-[10px] font-bold uppercase tracking-[0.16em] text-[#94a3b8]">
          Navigation
        </div>
        <Navigation
          activeScreen={screen}
          hasAnalysis={hasAnalysis}
          onNavigate={navigateTo}
        />
        <WorkspaceFooter />
      </aside>

      <main className="mx-auto min-h-[calc(100vh-68px)] max-w-[1600px] px-4 pb-12 pt-6 sm:px-6 sm:pt-8 lg:ml-[248px] lg:px-8 xl:px-10">
        {screen === "new-analysis" ? (
          <section aria-labelledby="new-analysis-heading" className="mx-auto max-w-5xl">
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0e7572]">
                New Analysis
              </p>
              <h1
                id="new-analysis-heading"
                className="mt-1 text-[26px] font-bold tracking-[-0.035em] text-[#142b4a] sm:text-[30px]"
              >
                Upload dental images
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[#64748b]">
                Add DICOM, compatible RVG, or PNG radiographs. When analysis is
                complete, you will be taken directly to the image and findings.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#e3e9f0] bg-white shadow-[0_1px_3px_rgba(20,43,74,0.04)]">
              <div className="flex flex-col gap-3 border-b border-[#eef2f6] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-base font-semibold tracking-tight text-[#142b4a]">
                      Study files
                    </h2>
                    <span className="rounded-full border border-[#ccece8] bg-[#f1fbfa] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#0e7572]">
                      DICOM & PNG imaging
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-[#8291a7]">
                    Add one or more studies to begin AI-assisted analysis.
                  </p>
                </div>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-[#f5f7fa] px-2.5 py-1.5 text-[11px] font-medium text-[#64748b]">
                  <FileImage className="size-3.5" aria-hidden="true" />
                  {files.length} {files.length === 1 ? "study" : "studies"}
                </span>
              </div>
              <div className="p-4 sm:p-6">
                <DicomDropzone
                  dicomDetectionMutation={dicomDetectionMutation}
                  onPredict={handlePredict}
                />
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#d9efed] bg-[#f0faf9] p-4">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#0e7572]" />
              <p className="text-xs leading-5 text-[#536f7e]">
                DICOM radiographs (.dcm, .dicom), DICOM-compatible RVG (.rvg),
                and PNG (.png), up to 10 MB per file. Findings are model
                predictions and require dentist review.
              </p>
            </div>
          </section>
        ) : (
          <section aria-labelledby="analysis-workspace-heading">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0e7572]">
                  Analysis Workspace
                </p>
                <h1
                  id="analysis-workspace-heading"
                  className="mt-1 text-[26px] font-bold tracking-[-0.035em] text-[#142b4a] sm:text-[30px]"
                >
                  Image review
                </h1>
                <p className="mt-1.5 text-sm leading-6 text-[#64748b]">
                  Inspect radiographs and model findings, then prepare a
                  dentist-reviewed impression.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={dicomDetectionMutation.isPending}
                onClick={startNewAnalysis}
              >
                <ScanLine className="size-4" />
                New Analysis
              </Button>
            </div>

            {hasAnalysis ? (
              <PredictionResults
                detectionProgress={detectionProgress}
                onReportGenerated={updateDiagnosticReport}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-[#d7e1eb] bg-white px-5 py-12 text-center">
                <p className="text-sm font-semibold text-[#263b55]">
                  No analysis is available
                </p>
                <p className="mt-1 text-xs text-[#8291a7]">
                  Start a new analysis to upload and review radiographs.
                </p>
                <Button className="mt-4" onClick={startNewAnalysis}>
                  <ScanLine className="size-4" />
                  New Analysis
                </Button>
              </div>
            )}
          </section>
        )}

        <footer className="mt-10 flex flex-col gap-2 border-t border-[#e3e9f0] pt-5 text-[11px] text-[#94a3b8] sm:flex-row sm:items-center sm:justify-between">
          <span>DentraAI · Dental imaging analysis workspace</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            AI-assisted review · Dentist confirmation required
          </span>
        </footer>
      </main>
    </div>
  );
}

function Navigation({
  activeScreen,
  hasAnalysis,
  onNavigate,
  mobile = false,
}: {
  activeScreen: WorkspaceScreen;
  hasAnalysis: boolean;
  onNavigate: (screen: WorkspaceScreen) => void;
  mobile?: boolean;
}) {
  return (
    <nav
      className={`space-y-1 px-3 ${mobile ? "py-3" : ""}`}
      aria-label="Analysis navigation"
    >
      {navigationItems.map(({ label, screen, icon: Icon }) => {
        const isDisabled = screen === "analysis-workspace" && !hasAnalysis;
        const isActive = activeScreen === screen;

        return (
          <button
            key={screen}
            type="button"
            aria-current={isActive ? "page" : undefined}
            disabled={isDisabled}
            onClick={() => onNavigate(screen)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 ${
              mobile ? "py-3" : "py-2.5"
            } text-left text-[13px] font-medium transition-colors ${
              isActive
                ? "bg-[#142b4a] text-white"
                : "text-[#53657d] hover:bg-[#f2f6fa] hover:text-[#142b4a]"
            } disabled:cursor-not-allowed disabled:opacity-45`}
          >
            <Icon className="size-[17px]" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function WorkspaceFooter() {
  return (
    <div className="mt-auto border-t border-[#e3e9f0] p-4">
      <div className="mb-3 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-2 font-medium text-[#0e7572]">
          <span className="size-2 rounded-full bg-[#14a69e]" />
          Imaging workflow
        </span>
        <span className="font-mono text-[#94a3b8]">10 MB max</span>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-[#e3e9f0] bg-[#f8fafc] p-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-[#e9f6f5] text-[#0e7572]">
          <ShieldCheck className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-[#142b4a]">
            Study workspace
          </p>
          <p className="mt-0.5 text-[10px] text-[#8291a7]">
            Dentist review required
          </p>
        </div>
      </div>
    </div>
  );
}
