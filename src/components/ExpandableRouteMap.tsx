import { Maximize2, X } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent, DialogClose } from "@/components/ui/dialog";
import { RouteMapView, type RouteMapViewProps } from "@/components/RouteMapView";

interface Props extends Omit<RouteMapViewProps, "height"> {
  /** Inline map height (the collapsed, in-page size). */
  height?: number;
  /** Chrome for the expanded dialog's card — pass theme tokens matching the
   * host page (public pages like the customer share link don't have the
   * app's CSS custom properties available). */
  dialogStyle?: React.CSSProperties;
}

const overlayBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  zIndex: 1000,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 4,
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.4)",
  background: "rgba(17,24,39,0.72)",
  color: "#fff",
};

// A RouteMapView with a small expand button overlaid on it that opens the
// same map, bigger, in a centered dialog — the same "view full screen"
// affordance QuoteBuilder's live map editor has, but for the read-only
// route maps on Quote Detail, Order Detail and the customer share link.
export function ExpandableRouteMap({ height = 220, dialogStyle, ...mapProps }: Props) {
  return (
    <div style={{ position: "relative" }}>
      <RouteMapView {...mapProps} height={height} />
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" title="Expand map" style={overlayBtnStyle}>
            <Maximize2 size={13} />
          </button>
        </DialogTrigger>
        <DialogContent hideClose style={{ width: "min(1400px, 95vw)", padding: 0, overflow: "hidden", ...dialogStyle }}>
          <div style={{ position: "relative" }}>
            <RouteMapView {...mapProps} height={typeof window !== "undefined" ? Math.round(Math.min(window.innerHeight * 0.78, 780)) : 600} />
            <DialogClose asChild>
              <button type="button" title="Close" style={overlayBtnStyle}>
                <X size={14} />
              </button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
