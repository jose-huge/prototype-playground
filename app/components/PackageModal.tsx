"use client";

import { useState }     from "react";
import { Download, Check, FileCode2, FileText, Image as ImageIcon, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button }  from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ComponentRecord } from "@/app/components/Playground";
import type { FigmaConfig }     from "@/hooks/useFigmaConfig";
import { packageForDev, predictFileList } from "@/app/lib/packageForDev";

interface Props {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  component:     ComponentRecord | null;
  frameId?:      string;
  figmaConfig:   FigmaConfig | null;
  figmaFileName: string;
  onMarkDone:    () => void;
}

type Phase = "preview" | "downloading" | "done";

function fileIcon(filename: string) {
  if (filename.endsWith(".png"))  return <ImageIcon  size={13} className="text-muted-foreground shrink-0" />;
  if (filename.endsWith(".css"))  return <FileText   size={13} className="text-sky-500 shrink-0" />;
  if (filename.endsWith(".md"))   return <FileText   size={13} className="text-amber-500 shrink-0" />;
  return                                 <FileCode2  size={13} className="text-violet-500 shrink-0" />;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

export default function PackageModal({
  open,
  onOpenChange,
  component,
  frameId,
  figmaConfig,
  figmaFileName,
  onMarkDone,
}: Props) {
  const [phase,     setPhase]     = useState<Phase>("preview");
  const [markDone,  setMarkDone]  = useState(false);

  // Reset phase whenever modal opens
  const handleOpenChange = (next: boolean) => {
    if (next) { setPhase("preview"); setMarkDone(false); }
    onOpenChange(next);
  };

  if (!component) return null;

  const fileList = predictFileList(component, !!frameId);

  const handleDownload = async () => {
    setPhase("downloading");
    try {
      await packageForDev({
        component,
        figmaConfig,
        frameId,
        figmaFileName,
      });
      setPhase("done");
    } catch (err) {
      console.error("Package for dev failed:", err);
      setPhase("preview"); // reset so user can retry
    }
  };

  const handleMarkDoneAndClose = () => {
    onMarkDone();
    onOpenChange(false);
    setPhase("preview");
  };

  const handleNotYet = () => {
    onOpenChange(false);
    setPhase("preview");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={phase !== "downloading"}>
        {phase !== "done" ? (
          <>
            <DialogHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-muted-foreground" />
                <DialogTitle>Package for dev</DialogTitle>
              </div>
            </DialogHeader>

            <DialogBody className="gap-3">
              {/* File list */}
              <div>
                <p className="mb-2 text-sm font-medium">
                  <span className="font-semibold">{component.name}.zip</span>{" "}
                  <span className="text-muted-foreground font-normal">will include:</span>
                </p>
                <ul className="space-y-1.5">
                  {fileList.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      {fileIcon(f)}
                      <span className="font-mono text-xs">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              {/* Metadata */}
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Built with</dt>
                <dd className="font-medium">{component.builtWith}</dd>

                <dt className="text-muted-foreground">Figma frame</dt>
                <dd className="font-medium truncate">{component.frame || "—"}</dd>

                <dt className="text-muted-foreground">Date</dt>
                <dd className="font-medium">{formatDate(component.date)}</dd>

                {figmaFileName && (
                  <>
                    <dt className="text-muted-foreground">Figma file</dt>
                    <dd className="font-medium truncate">{figmaFileName}</dd>
                  </>
                )}
              </dl>
            </DialogBody>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={phase === "downloading"}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDownload}
                disabled={phase === "downloading"}
              >
                {phase === "downloading" ? (
                  <>Assembling…</>
                ) : (
                  <>
                    <Download size={14} />
                    Download zip
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          /* ── Post-download: mark done? ── */
          <>
            <DialogHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Check size={16} className="text-green-500" />
                <DialogTitle>{component.name}.zip downloaded</DialogTitle>
              </div>
            </DialogHeader>

            <DialogBody>
              <p className="text-sm text-muted-foreground">
                Mark{" "}
                <span className="font-semibold text-foreground">{component.name}</span>{" "}
                as done?
              </p>
            </DialogBody>

            <DialogFooter>
              <Button variant="outline" onClick={handleNotYet}>
                Not yet
              </Button>
              <Button onClick={handleMarkDoneAndClose}>
                Yes, mark done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
