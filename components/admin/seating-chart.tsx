"use client";

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TENT_WIDTH_FT,
  TENT_DEPTH_FT,
  ROUND_TABLE_DIAMETER_FT,
  ROUND_TABLE_FOOTPRINT_FT,
  HEAD_TABLE_WIDTH_FT,
  HEAD_TABLE_DEPTH_FT,
  DEFAULT_SEAT_COUNT,
  MAX_SEAT_COUNT,
  MAX_ROUND_TABLES,
  MIN_HEAD_TABLE_SEATS,
  MAX_HEAD_TABLE_SEATS,
  headTableWidthFor,
  seatOffsetsFor,
  initialsFor,
  truncateForPlan,
  snapAndClamp,
  SNAP_FT,
  findCrowdedPairs,
  guestMatches,
  searchPlacements,
  compareFloorObjects,
  FIT_VIEW,
  zoomView,
  clampView,
  type ViewBox,
  type FloorObject,
  type SeatedGuest,
  type AttendingGuest,
} from "@/lib/seating";
import { SeatingMobileList } from "@/components/admin/seating-mobile-list";
import {
  addRoundTable,
  addHeadTable,
  generateRoundTables,
  updateObjectPosition,
  updateObjectPositions,
  updateObject,
  updateSeatCounts,
  deleteObject,
  deleteObjects,
  assignSeat,
  unassignSeat,
  seatPartyAtTable,
  swapSeats,
  clearTable,
  type MutationResult,
} from "@/lib/actions/seating";
import { undoSeating, redoSeating } from "@/lib/actions/seating-history";
import type { HistoryState } from "@/lib/seating-history-core";


/**
 * Autosave indicator state. Every edit writes to Supabase immediately, so
 * there is no "unsaved" state to worry about; this exists purely so you can
 * SEE that, and so a failed write is loud instead of silent.
 */
type SaveStatus = "idle" | "saving" | "saved" | "error";

/** What's being dragged from the guest list onto the floor plan. */
type DragPayload =
  | { kind: "guest"; guest: AttendingGuest }
  | { kind: "party"; partyId: string; name: string; count: number };

/**
 * How far the pointer must travel before a press on a guest row becomes a
 * drag rather than a click. Without a threshold, every click would register
 * as a tiny drag and the click-to-seat path would stop working.
 */
const DRAG_THRESHOLD_PX = 5;

export function SeatingChart({
  objects,
  assignments,
  guests,
  history,
}: {
  objects: FloorObject[];
  assignments: SeatedGuest[];
  guests: AttendingGuest[];
  history: HistoryState;
}) {
  const router = useRouter();
  // Local copy so dragging is instant. Server is the source of truth for
  // everything else; positions sync back on the next revalidate.
  const [localObjects, setLocalObjects] = useState(objects);
  // Seat assignments are applied locally the moment you click and reconciled
  // with the server afterwards. Seating 209 people is hundreds of clicks; at
  // ~2s of round-trip each that was the difference between a tool you can use
  // and one you fight.
  const [localAssignments, setLocalAssignments] = useState(assignments);
  /**
   * Synchronous mirror of localAssignments.
   *
   * React state does not update between synchronous clicks, so five rapid
   * clicks would all read the same "first free seat" from the same stale
   * render and collide on it. This ref is written immediately, so each click
   * sees the seats the previous ones just took.
   */
  const assignmentsRef = useRef<SeatedGuest[]>(assignments);
  // A Set, not a single id: shift-click builds a multi-selection, and the
  // whole selection drags together.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetSeat, setTargetSeat] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [expanded, setExpanded] = useState(false);

  /**
   * Which face the small-screen layout shows. Defaults to the list because
   * that's the one you can actually use on a phone; the plan is a tab away.
   * Ignored at xl and up, where both are on screen at once.
   */
  const [mobileView, setMobileView] = useState<"list" | "plan">("list");

  /** Pan and zoom for the floor plan. */
  const [view, setView] = useState<ViewBox>(FIT_VIEW);
  /**
   * Mirror of `view` for the gesture handlers.
   *
   * Lifting one finger of a pinch re-arms the gesture as a pan, and that has
   * to start from where the view actually IS. Reading the `view` state there
   * would read the value captured when the handler was created, which is one
   * or more setView calls behind by then, and the plan would jump.
   */
  const viewRef = useRef<ViewBox>(FIT_VIEW);
  // Written in an effect rather than during render: mutating a ref while
  // rendering isn't safe under concurrent React. Being one commit behind
  // costs nothing here, because gestures only read it from pointer handlers,
  // which fire well after paint.
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  /**
   * Briefly highlight a guest's row after jumping to them from search, so you
   * can see which of eight names at the table you were looking for.
   */
  const [flashGuestId, setFlashGuestId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // History arrives from the server on every revalidate, but drag saves
  // deliberately skip revalidation, so we keep a local copy the actions can
  // update directly.
  const [historyState, setHistoryState] = useState(history);
  useEffect(() => setHistoryState(history), [history]);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    ids: string[];
    /** Pointer position in feet when the drag began. */
    startX: number;
    startY: number;
    /** Where each dragged object sat before the drag, to apply a shared delta. */
    origins: Map<string, { x: number; y: number }>;
  } | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dragging a person or party from the list onto the plan.
  // `pendingDrag` is armed on pointerdown; it only becomes a real drag once
  // the pointer moves past the threshold, so plain clicks still seat people.
  const [pendingDrag, setPendingDrag] = useState<DragPayload | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    objectId: string;
    seatNumber: number | null;
  } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);

  useEffect(() => {
    setLocalObjects(objects);
  }, [objects]);

  useEffect(() => {
    assignmentsRef.current = assignments;
    setLocalAssignments(assignments);
  }, [assignments]);

  /** Write both the ref (immediately) and the state (for rendering). */
  const applyLocal = useCallback((next: SeatedGuest[]) => {
    assignmentsRef.current = next;
    setLocalAssignments(next);
  }, []);

  // Clear the pending "Saved" fade timer if the component unmounts mid-flight.
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const guestById = useMemo(
    () => new Map(guests.map((g) => [g.id, g])),
    [guests]
  );

  const objectById = useMemo(
    () => new Map(localObjects.map((o) => [o.id, o])),
    [localObjects]
  );

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  /** Jump to whichever table a guest is sitting at and flag their row. */
  const revealGuest = useCallback((objectId: string, guestId: string) => {
    setSelectedIds(new Set([objectId]));
    setTargetSeat(null);
    setFlashGuestId(guestId);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashGuestId(null), 2500);
  }, []);

  const assignmentByGuest = useMemo(
    () => new Map(localAssignments.map((a) => [a.guest_id, a])),
    [localAssignments]
  );

  /** objectId -> assignments at that object */
  const assignmentsByObject = useMemo(() => {
    const map = new Map<string, SeatedGuest[]>();
    for (const a of localAssignments) {
      const list = map.get(a.object_id) ?? [];
      list.push(a);
      map.set(a.object_id, list);
    }
    return map;
  }, [localAssignments]);

  /** "objectId:seatNumber" -> guest sitting there */
  const occupantBySeat = useMemo(() => {
    const map = new Map<string, AttendingGuest>();
    for (const a of localAssignments) {
      if (a.seat_number === null) continue;
      const guest = guestById.get(a.guest_id);
      if (guest) map.set(`${a.object_id}:${a.seat_number}`, guest);
    }
    return map;
  }, [localAssignments, guestById]);

  const unseated = useMemo(
    () => guests.filter((g) => !assignmentByGuest.has(g.id)),
    [guests, assignmentByGuest]
  );

  const crowded = useMemo(() => findCrowdedPairs(localObjects), [localObjects]);

  const selectedObjects = useMemo(
    () => localObjects.filter((o) => selectedIds.has(o.id)),
    [localObjects, selectedIds]
  );

  // The detail panel only makes sense for exactly one table; a multi-selection
  // gets the bulk panel instead.
  const selected = selectedObjects.length === 1 ? selectedObjects[0] : null;

  const totalSeats = localObjects.reduce((sum, o) => sum + o.seat_count, 0);
  const roundTableCount = localObjects.filter(
    (o) => o.kind === "round_table"
  ).length;

  /**
   * Parties that ended up split across multiple tables. Not an error (you
   * sometimes have to split a big family), but you almost never want it by
   * accident, so it gets surfaced.
   */
  const splitParties = useMemo(() => {
    const tablesByParty = new Map<string, Set<string>>();
    for (const a of localAssignments) {
      const guest = guestById.get(a.guest_id);
      if (!guest) continue;
      const set = tablesByParty.get(guest.party_id) ?? new Set<string>();
      set.add(a.object_id);
      tablesByParty.set(guest.party_id, set);
    }
    return [...tablesByParty.entries()]
      .filter(([, tables]) => tables.size > 1)
      .map(([partyId]) => partyId);
  }, [localAssignments, guestById]);

  // ---- drag handling -------------------------------------------------

  function clientToFeet(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  }

  /**
   * Half-extents per axis, used to keep a dragged object inside the tent.
   * Per-axis rather than a single number: a 24ft-wide head table is only
   * 2.5ft deep, and clamping its vertical range by its width would lock it
   * out of most of the tent.
   */
  function halfExtents(obj: FloorObject) {
    if (obj.kind === "round_table") {
      const r = (obj.diameter_ft ?? ROUND_TABLE_DIAMETER_FT) / 2;
      return { x: r, y: r };
    }
    return {
      x: (obj.width_ft ?? 0) / 2,
      y: (obj.height_ft ?? 0) / 2,
    };
  }

  function handlePointerDown(e: React.PointerEvent, obj: FloorObject) {
    e.stopPropagation();
    setTargetSeat(null);

    // Shift-click toggles membership and never starts a drag: you're building
    // a selection, and moving things mid-build would be surprising.
    if (e.shiftKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(obj.id)) next.delete(obj.id);
        else next.add(obj.id);
        return next;
      });
      return;
    }

    // Grabbing a table that's already part of the selection drags the whole
    // group. Grabbing one outside it replaces the selection with just that
    // table, which is how every canvas editor behaves.
    const draggingIds = selectedIds.has(obj.id) ? [...selectedIds] : [obj.id];
    if (!selectedIds.has(obj.id)) setSelectedIds(new Set([obj.id]));

    const p = clientToFeet(e.clientX, e.clientY);
    const origins = new Map<string, { x: number; y: number }>();
    for (const id of draggingIds) {
      const o = localObjects.find((it) => it.id === id);
      if (o) origins.set(id, { x: o.x_ft, y: o.y_ft });
    }

    dragRef.current = {
      ids: draggingIds,
      startX: p.x,
      startY: p.y,
      origins,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent, obj: FloorObject) {
    const drag = dragRef.current;
    if (!drag || !drag.ids.includes(obj.id)) return;

    const p = clientToFeet(e.clientX, e.clientY);

    // One shared delta for the whole group, snapped once. Clamping each table
    // independently would squash the group's shape as it hit a tent wall, so
    // instead the delta itself is clamped to what every member can accept.
    let dx = Math.round((p.x - drag.startX) / SNAP_FT) * SNAP_FT;
    let dy = Math.round((p.y - drag.startY) / SNAP_FT) * SNAP_FT;

    let minDx = -Infinity;
    let maxDx = Infinity;
    let minDy = -Infinity;
    let maxDy = Infinity;

    for (const id of drag.ids) {
      const o = localObjects.find((it) => it.id === id);
      const origin = drag.origins.get(id);
      if (!o || !origin) continue;
      const half = halfExtents(o);
      minDx = Math.max(minDx, half.x - origin.x);
      maxDx = Math.min(maxDx, TENT_WIDTH_FT - half.x - origin.x);
      minDy = Math.max(minDy, half.y - origin.y);
      maxDy = Math.min(maxDy, TENT_DEPTH_FT - half.y - origin.y);
    }

    dx = Math.min(maxDx, Math.max(minDx, dx));
    dy = Math.min(maxDy, Math.max(minDy, dy));

    setLocalObjects((prev) =>
      prev.map((o) => {
        const origin = drag.origins.get(o.id);
        if (!origin) return o;
        return { ...o, x_ft: origin.x + dx, y_ft: origin.y + dy };
      })
    );
  }

  function handlePointerUp(e: React.PointerEvent, obj: FloorObject) {
    const drag = dragRef.current;
    if (!drag || !drag.ids.includes(obj.id)) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);

    // Only save what actually moved. A plain click to select would otherwise
    // write a no-op and pile up junk undo entries. Compared against the drag
    // origins, not the local objects, which are already updated by now.
    const moved = drag.ids
      .map((id) => localObjects.find((o) => o.id === id))
      .filter((o): o is FloorObject => Boolean(o))
      .filter((o) => {
        const origin = drag.origins.get(o.id);
        return origin && (o.x_ft !== origin.x || o.y_ft !== origin.y);
      });

    if (moved.length === 0) return;

    if (moved.length === 1) {
      run(() =>
        updateObjectPosition(moved[0].id, moved[0].x_ft, moved[0].y_ft)
      );
    } else {
      run(() =>
        updateObjectPositions(
          moved.map((o) => ({ id: o.id, xFt: o.x_ft, yFt: o.y_ft }))
        )
      );
    }
  }

  // ---- pan and zoom --------------------------------------------------
  //
  // Only ever started from the canvas background: a press on a table calls
  // stopPropagation, so dragging a table never doubles as a pan. Pointers are
  // tracked in a ref keyed by pointerId, which is also what makes the handlers
  // ignore the moves belonging to an in-flight table drag.

  const viewPointersRef = useRef(new Map<number, { x: number; y: number }>());
  const gestureRef = useRef<{
    mode: "pan" | "pinch";
    startView: ViewBox;
    /** Feet per screen pixel, captured before the view starts changing. */
    ftPerPx: number;
    originX: number;
    originY: number;
    focusFt: { x: number; y: number };
    startDistance: number;
  } | null>(null);

  /** (Re)arm a gesture from whatever pointers are currently down. */
  const beginGesture = useCallback(() => {
    const points = [...viewPointersRef.current.values()];
    if (points.length === 0) {
      gestureRef.current = null;
      return;
    }

    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    // ctm.a is screen pixels per user unit, and a user unit here is one foot.
    const ftPerPx = ctm && ctm.a !== 0 ? 1 / ctm.a : 0;

    const originX =
      points.length >= 2 ? (points[0].x + points[1].x) / 2 : points[0].x;
    const originY =
      points.length >= 2 ? (points[0].y + points[1].y) / 2 : points[0].y;

    gestureRef.current = {
      mode: points.length >= 2 ? "pinch" : "pan",
      startView: viewRef.current,
      ftPerPx,
      originX,
      originY,
      focusFt: clientToFeet(originX, originY),
      startDistance:
        points.length >= 2
          ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
          : 0,
    };
  }, []);

  function handleCanvasPointerDown(e: React.PointerEvent) {
    setSelectedIds(new Set());
    setTargetSeat(null);
    viewPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    beginGesture();
  }

  function handleCanvasPointerMove(e: React.PointerEvent) {
    const pointers = viewPointersRef.current;
    // Not a pointer we're tracking: it belongs to a table drag.
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const gesture = gestureRef.current;
    if (!gesture || gesture.ftPerPx === 0) return;

    const points = [...pointers.values()];

    if (gesture.mode === "pinch" && points.length >= 2) {
      const distance = Math.hypot(
        points[0].x - points[1].x,
        points[0].y - points[1].y
      );
      if (gesture.startDistance === 0 || distance === 0) return;
      const scale = distance / gesture.startDistance;
      setView(
        clampView(
          zoomView(gesture.startView, gesture.startView.w / scale, gesture.focusFt)
        )
      );
      return;
    }

    if (gesture.mode === "pan") {
      // The room follows the finger, so the viewBox moves the other way.
      const dxFt = (e.clientX - gesture.originX) * gesture.ftPerPx;
      const dyFt = (e.clientY - gesture.originY) * gesture.ftPerPx;
      setView(
        clampView({
          ...gesture.startView,
          x: gesture.startView.x - dxFt,
          y: gesture.startView.y - dyFt,
        })
      );
    }
  }

  function endCanvasPointer(e: React.PointerEvent) {
    viewPointersRef.current.delete(e.pointerId);
    // Lifting one finger of a pinch should leave the other one panning, not
    // freeze the canvas, so re-arm from what's left.
    beginGesture();
  }

  /** Zoom by a factor about the middle of the canvas. */
  const zoomByFactor = useCallback((factor: number) => {
    setView((current) =>
      clampView(
        zoomView(current, current.w / factor, {
          x: current.x + current.w / 2,
          y: current.y + current.h / 2,
        })
      )
    );
  }, []);

  const atFitZoom = view.w >= FIT_VIEW.w - 0.01;

  /**
   * Trackpad pinch and ctrl+wheel zoom. Bound natively rather than with
   * onWheel because React's wheel listener is passive, and preventDefault is
   * what stops the browser zooming the whole page instead.
   */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return; // plain wheel still scrolls the page
      e.preventDefault();
      const element = svgRef.current;
      const ctm = element?.getScreenCTM();
      setView((current) => {
        const focus =
          ctm && ctm.a !== 0
            ? new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
            : { x: current.x + current.w / 2, y: current.y + current.h / 2 };
        return clampView(
          zoomView(current, current.w * Math.exp(e.deltaY * 0.002), focus)
        );
      });
    }

    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // ---- action helpers ------------------------------------------------

  /**
   * Run a mutation, tracking save state so the UI can show that the write
   * landed. Every action here persists immediately; this wrapper is what
   * makes that visible instead of merely true.
   */
  const run = useCallback(
    (fn: () => Promise<MutationResult>) => {
      setError(null);
      setSaveStatus("saving");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

      startTransition(async () => {
        try {
          const result = await fn();
          if (result.error) {
            setError(result.error);
            setSaveStatus("error");
            return;
          }
          if (result.history) setHistoryState(result.history);
          setSaveStatus("saved");
          // Fade the confirmation rather than leaving it up forever.
          savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
        } catch {
          // Network dropped, deploy mid-request, etc. Previously this was a
          // silent failure on drags; now it surfaces.
          setError("Couldn't reach the server. Your last change may not have saved.");
          setSaveStatus("error");
        }
      });
    },
    []
  );

  /**
   * Apply a seat change locally straight away, then send it.
   *
   * The server stays the source of truth: if it rejects the change we put the
   * previous assignments back and surface the error, so an optimistic UI can
   * never quietly disagree with the database. The actions these call skip
   * revalidation, otherwise the refetch would race the local state and make
   * seats flicker between old and new.
   */
  const optimistic = useCallback(
    (
      compute: (prev: SeatedGuest[]) => SeatedGuest[],
      action: () => Promise<MutationResult>
    ) => {
      applyLocal(compute(assignmentsRef.current));

      setError(null);
      setSaveStatus("saving");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

      startTransition(async () => {
        try {
          const result = await action();
          if (result.error) {
            setError(result.error);
            setSaveStatus("error");
            // Resync from the server rather than restoring a local snapshot:
            // other writes may have landed in the meantime, and rolling back
            // to a stale copy would clobber them.
            router.refresh();
            return;
          }
          if (result.history) setHistoryState(result.history);
          setSaveStatus("saved");
          savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
        } catch {
          setError(
            "Couldn't reach the server. Your last change may not have saved."
          );
          setSaveStatus("error");
          router.refresh();
        }
      });
    },
    [applyLocal, router]
  );

  /** Put a guest in a seat locally, removing any seat they already held. */
  function withGuestSeated(
    prev: SeatedGuest[],
    guestId: string,
    objectId: string,
    seatNumber: number | null
  ): SeatedGuest[] {
    return [
      ...prev.filter((a) => a.guest_id !== guestId),
      { guest_id: guestId, object_id: objectId, seat_number: seatNumber },
    ];
  }

  /** Lowest free chairs at a table, computed from local state. */
  function freeSeatsAt(obj: FloorObject, from: SeatedGuest[]): number[] {
    const taken = new Set(
      from
        .filter((a) => a.object_id === obj.id)
        .map((a) => a.seat_number)
        .filter((n): n is number => n !== null)
    );
    const free: number[] = [];
    for (let n = 1; n <= obj.seat_count; n++) if (!taken.has(n)) free.push(n);
    return free;
  }

  /**
   * Swap two chairs at a table, or move someone onto an empty one.
   * Applied locally first like every other seat change.
   */
  function handleSwapSeats(objectId: string, seatA: number, seatB: number) {
    if (seatA === seatB) return;
    optimistic(
      (prev) =>
        prev.map((a) => {
          if (a.object_id !== objectId) return a;
          if (a.seat_number === seatA) return { ...a, seat_number: seatB };
          if (a.seat_number === seatB) return { ...a, seat_number: seatA };
          return a;
        }),
      () => swapSeats(objectId, seatA, seatB)
    );
  }

  function handleSeatParty(partyId: string, obj: FloorObject) {
    const seatedIds = new Set(assignmentsRef.current.map((a) => a.guest_id));
    const toSeat = guests.filter(
      (g) => g.party_id === partyId && !seatedIds.has(g.id)
    );
    if (toSeat.length === 0) {
      setError("Everyone in that party is already seated.");
      return;
    }
    const free = freeSeatsAt(obj, assignmentsRef.current);
    if (free.length < toSeat.length) {
      // Checked locally as well as on the server so the seats never visibly
      // fill and then snap back.
      setError(
        `Only ${free.length} seat${free.length === 1 ? "" : "s"} free at ${obj.label}, but ${toSeat.length} to seat.`
      );
      return;
    }

    optimistic(
      (prev) => {
        let next = prev;
        toSeat.forEach((g, i) => {
          next = withGuestSeated(next, g.id, obj.id, free[i]);
        });
        return next;
      },
      () => seatPartyAtTable(partyId, obj.id)
    );
  }

  const handleUndo = useCallback(() => {
    run(async () => {
      const result = await undoSeating();
      if (result.history) setHistoryState(result.history);
      router.refresh();
      return result;
    });
  }, [run, router]);

  const handleRedo = useCallback(() => {
    run(async () => {
      const result = await redoSeating();
      if (result.history) setHistoryState(result.history);
      router.refresh();
      return result;
    });
  }, [run, router]);

  // Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z, skipped while typing in a field so
  // undo still means "undo my typing" inside the table-name input.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();
      if (e.shiftKey) {
        if (historyState.canRedo) handleRedo();
      } else if (historyState.canUndo) {
        handleUndo();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [historyState.canUndo, historyState.canRedo, handleUndo, handleRedo]);

  // Escape leaves the expanded floor plan, or clears the selection.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (expanded) setExpanded(false);
      else setSelectedIds(new Set());
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded]);

  /**
   * Window-level listeners for dragging a person onto the plan.
   *
   * Bound to the window rather than the row because the pointer has to travel
   * from an HTML list into an SVG canvas, and no single element contains both.
   */
  useEffect(() => {
    if (!pendingDrag) return;

    // Belt and braces: suppress selection document-wide for the duration of
    // the drag. The pointerdown preventDefault handles the common path, but
    // this also covers text the pointer sweeps across on its way to the plan.
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    function onMove(e: PointerEvent) {
      const start = dragStartRef.current;
      if (!start) return;

      if (
        !didDragRef.current &&
        Math.hypot(e.clientX - start.x, e.clientY - start.y) <
          DRAG_THRESHOLD_PX
      ) {
        return;
      }

      didDragRef.current = true;
      setDragging(true);
      setDragPos({ x: e.clientX, y: e.clientY });
      setDropTarget(hitTest(e.clientX, e.clientY));
    }

    function onUp(e: PointerEvent) {
      const wasDrag = didDragRef.current;
      const payload = pendingDrag;
      const target = wasDrag ? hitTest(e.clientX, e.clientY) : null;

      setPendingDrag(null);
      setDragging(false);
      setDragPos(null);
      setDropTarget(null);
      dragStartRef.current = null;

      if (!wasDrag || !target || !payload) return;

      const obj = localObjects.find((o) => o.id === target.objectId);
      if (!obj) return;

      if (payload.kind === "party") {
        // A party fills consecutive free chairs; a specific chair is
        // meaningless for a group, so the seat under the cursor is ignored.
        handleSeatParty(payload.partyId, obj);
        return;
      }

      const seat = target.seatNumber ?? freeSeatsAt(obj, assignmentsRef.current)[0];
      if (seat === undefined || seat === null) {
        setError(`${obj.label} is full.`);
        return;
      }
      optimistic(
        (prev) => withGuestSeated(prev, payload.guest.id, obj.id, seat),
        () => assignSeat(payload.guest.id, obj.id, seat)
      );
    }

    // Cancel cleanly if the OS takes the pointer away mid-drag.
    function onCancel() {
      setPendingDrag(null);
      setDragging(false);
      setDragPos(null);
      setDropTarget(null);
      dragStartRef.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      document.body.style.userSelect = previousUserSelect;
    };
  }, [pendingDrag, localObjects, run]);

  // Delete/Backspace removes the selected table.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      if (selectedIds.size === 0) return;

      // Backspace is "delete a character" while typing, and on some browsers
      // it still triggers back-navigation. Never hijack it inside a field.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const ids = [...selectedIds];
      const tables = localObjects.filter((o) => selectedIds.has(o.id));
      if (tables.length === 0) return;

      e.preventDefault();

      // Deleting seated tables throws those guests back into the unseated
      // pile, which is a lot of work to lose to a stray keypress. Undo would
      // recover it, but a confirm is cheaper than discovering it later.
      const seated = ids.reduce(
        (sum, id) => sum + (assignmentsByObject.get(id) ?? []).length,
        0
      );
      if (seated > 0) {
        const what =
          tables.length === 1 ? tables[0].label : `${tables.length} tables`;
        const ok = window.confirm(
          `Delete ${what}? ${seated} ${seated === 1 ? "person" : "people"} seated there will go back to unseated.`
        );
        if (!ok) return;
      }

      setSelectedIds(new Set());
      run(() => (ids.length === 1 ? deleteObject(ids[0]) : deleteObjects(ids)));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIds, localObjects, assignmentsByObject, run]);

  // ---- drag a guest or party from the list onto the plan ---------------

  /**
   * Which table (and optionally which chair) sits under a screen point.
   *
   * Works in feet against the object list rather than hit-testing DOM nodes,
   * so the same math that draws a seat decides what a drop lands on. Seats win
   * over tables: dropping right on a chair means that chair specifically.
   *
   * Rotation is ignored, which is fine while every object is axis-aligned.
   */
  function hitTest(
    clientX: number,
    clientY: number
  ): { objectId: string; seatNumber: number | null } | null {
    const p = clientToFeet(clientX, clientY);

    for (const obj of localObjects) {
      const offsets = seatOffsetsFor(obj);
      for (let i = 0; i < offsets.length; i++) {
        const sx = obj.x_ft + offsets[i].x;
        const sy = obj.y_ft + offsets[i].y;
        if (Math.hypot(p.x - sx, p.y - sy) <= 1.0) {
          return { objectId: obj.id, seatNumber: i + 1 };
        }
      }
    }

    for (const obj of localObjects) {
      if (obj.kind === "round_table") {
        const r = (obj.diameter_ft ?? ROUND_TABLE_DIAMETER_FT) / 2;
        if (Math.hypot(p.x - obj.x_ft, p.y - obj.y_ft) <= r + 1.6) {
          return { objectId: obj.id, seatNumber: null };
        }
      } else {
        const hw = (obj.width_ft ?? HEAD_TABLE_WIDTH_FT) / 2;
        const hh = (obj.height_ft ?? HEAD_TABLE_DEPTH_FT) / 2;
        if (
          Math.abs(p.x - obj.x_ft) <= hw + 1.6 &&
          Math.abs(p.y - obj.y_ft) <= hh + 1.6
        ) {
          return { objectId: obj.id, seatNumber: null };
        }
      }
    }

    return null;
  }

  function beginPersonDrag(e: React.PointerEvent, payload: DragPayload) {
    if (e.button !== 0) return;

    // Stop the browser from starting a text selection. Without this, pressing
    // on a name and moving the pointer drags a selection highlight up through
    // the whole panel, because that's what a mouse drag over text means by
    // default. preventDefault here suppresses the compatibility mousedown
    // that would begin it; the click event still fires, so click-to-seat is
    // unaffected.
    e.preventDefault();

    // Clear anything already highlighted from a previous stray drag.
    window.getSelection()?.removeAllRanges();

    dragStartRef.current = { x: e.clientX, y: e.clientY };
    didDragRef.current = false;
    setPendingDrag(payload);
  }


  /**
   * Seat a guest in one specific chair.
   *
   * Doubles as the "move them here" path: assignSeat upserts on guest_id and
   * withGuestSeated drops their previous row locally, so someone already
   * sitting elsewhere moves rather than being double-booked.
   */
  function handleSeatGuestAt(
    guestId: string,
    objectId: string,
    seatNumber: number
  ) {
    const occupant = occupantBySeat.get(`${objectId}:${seatNumber}`);
    if (occupant && occupant.id !== guestId) {
      // Checked locally too, so the seat never visibly fills and snaps back.
      setError("That seat is already taken.");
      return;
    }
    optimistic(
      (prev) => withGuestSeated(prev, guestId, objectId, seatNumber),
      () => assignSeat(guestId, objectId, seatNumber)
    );
  }

  function handleAssign(guest: AttendingGuest) {
    if (!selected) return;
    // From the ref, so back-to-back clicks each get the next chair.
    const seat = targetSeat ?? freeSeatsAt(selected, assignmentsRef.current)[0];
    if (seat === undefined || seat === null) {
      setError(`${selected.label} is full.`);
      return;
    }
    // Release the explicit target so the next pick falls through to the lowest
    // empty chair. Lets you seat a whole table by clicking names in a row,
    // each one landing instantly off local state.
    setTargetSeat(null);
    optimistic(
      (prev) => withGuestSeated(prev, guest.id, selected.id, seat),
      () => assignSeat(guest.id, selected.id, seat)
    );
  }

  function exportCsv() {
    const headers = ["Table", "Group", "Seat", "Guest", "Party"];
    const rows: string[][] = [];

    // Same natural order as the printed chart: head table, then Table 1..25.
    // sort_order drifts as tables are added and removed, and localeCompare
    // puts Table 10 ahead of Table 9.
    const ordered = [...localObjects].sort(compareFloorObjects);

    for (const obj of ordered) {
      for (let n = 1; n <= obj.seat_count; n++) {
        const guest = occupantBySeat.get(`${obj.id}:${n}`);
        if (!guest) continue;
        rows.push([
          csvEscape(obj.label),
          csvEscape(obj.internal_name ?? ""),
          String(n),
          csvEscape(`${guest.first_name} ${guest.last_name}`),
          csvEscape(guest.party_name),
        ]);
      }
      // People parked at the table with no chair chosen
      for (const a of assignmentsByObject.get(obj.id) ?? []) {
        if (a.seat_number !== null) continue;
        const guest = guestById.get(a.guest_id);
        if (!guest) continue;
        rows.push([
          csvEscape(obj.label),
          csvEscape(obj.internal_name ?? ""),
          "",
          csvEscape(`${guest.first_name} ${guest.last_name}`),
          csvEscape(guest.party_name),
        ]);
      }
    }

    for (const guest of unseated) {
      rows.push([
        "UNSEATED",
        "",
        "",
        csvEscape(`${guest.first_name} ${guest.last_name}`),
        csvEscape(guest.party_name),
      ]);
    }

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seating-chart-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- render --------------------------------------------------------

  return (
    <div
      className={
        expanded
          ? // Fixed overlay so the plan uses the whole window. The sidebar and
            // page padding are behind it, which is the point.
            "fixed inset-0 z-40 bg-cream p-4 overflow-auto"
          : "max-w-[1600px]"
      }
    >
      {!expanded && (
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="font-heading text-3xl text-deep-sage">Seating</h1>
            <p className="text-sm text-dark/60 mt-1">
              {TENT_WIDTH_FT}&prime; &times; {TENT_DEPTH_FT}&prime; tent &middot;{" "}
              {ROUND_TABLE_DIAMETER_FT * 12}&Prime; round tables &middot; drag to
              rearrange
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="px-5 py-2.5 rounded-lg border border-sage/50 text-dark/80 text-sm font-medium hover:bg-sage/10 transition-colors"
            >
              Export CSV
            </button>
            <Link
              href="/admin/seating/print"
              className="px-5 py-2.5 rounded-lg bg-pink text-dark text-sm font-medium hover:bg-pink/80 focus:outline-none focus:ring-2 focus:ring-pink focus:ring-offset-2 focus:ring-offset-cream transition-colors"
            >
              Print chart
            </Link>
          </div>
        </div>
      )}

      {/* Undo/redo + autosave status */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <UndoRedoBar
          history={historyState}
          onUndo={handleUndo}
          onRedo={handleRedo}
          disabled={isPending}
        />
        <SaveIndicator status={saveStatus} history={historyState} />
      </div>

      {/* Small screens pick one view at a time. Above xl both are on screen,
          so the switch is hidden and neither side is ever hidden by it. */}
      {!expanded && (
        <div
          role="tablist"
          aria-label="Seating view"
          className="xl:hidden flex gap-1 p-1 mb-4 rounded-lg bg-sage/15 border border-sage/30"
        >
          {(["list", "plan"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mobileView === tab}
              onClick={() => setMobileView(tab)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mobileView === tab
                  ? "bg-white text-deep-sage shadow-sm"
                  : "text-dark/55 hover:text-deep-sage"
              }`}
            >
              {tab === "list" ? "Tables & guests" : "Floor plan"}
            </button>
          ))}
        </div>
      )}

      {/* Drag ghost. Fixed to the viewport and pointer-events-none so it never
          swallows the pointermove that's driving the drag. */}
      {dragging && dragPos && pendingDrag && (
        <div
          className="fixed z-50 pointer-events-none px-2.5 py-1 rounded-lg bg-pink text-dark text-xs font-medium shadow-lg border border-deep-sage/30"
          style={{ left: dragPos.x + 12, top: dragPos.y + 12 }}
        >
          {pendingDrag.kind === "guest"
            ? `${pendingDrag.guest.first_name} ${pendingDrag.guest.last_name}`
            : `${pendingDrag.name} (${pendingDrag.count})`}
          {dropTarget === null && (
            <span className="text-dark/50"> &middot; drop on a table</span>
          )}
        </div>
      )}

      {/* Stats bar. Hidden when expanded to give the plan the vertical room. */}
      {!expanded && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <Stat label="Attending" value={guests.length} />
          <Stat label="Seated" value={guests.length - unseated.length} />
          <Stat
            label="Unseated"
            value={unseated.length}
            tone={unseated.length > 0 ? "warn" : "ok"}
          />
          <Stat
            label="Seats available"
            value={totalSeats}
            tone={totalSeats < guests.length ? "warn" : "ok"}
          />
        </div>
      )}

      {totalSeats < guests.length && roundTableCount > 0 && (
        <Banner tone="warn">
          {guests.length - totalSeats} more seat
          {guests.length - totalSeats === 1 ? "" : "s"} needed. At{" "}
          {DEFAULT_SEAT_COUNT} per table that&apos;s{" "}
          {Math.ceil((guests.length - totalSeats) / DEFAULT_SEAT_COUNT)} more
          table
          {Math.ceil((guests.length - totalSeats) / DEFAULT_SEAT_COUNT) === 1
            ? ""
            : "s"}
          .
        </Banner>
      )}

      {crowded.size > 0 && (
        <Banner tone="warn">
          {crowded.size} table{crowded.size === 1 ? " is" : "s are"} closer than{" "}
          {ROUND_TABLE_FOOTPRINT_FT}&prime; apart (shown in red). Guests would be
          back to back with no room to walk between them.
        </Banner>
      )}

      {splitParties.length > 0 && (
        <Banner tone="info">
          {splitParties.length}{" "}
          {splitParties.length === 1 ? "party is" : "parties are"} split across
          more than one table.
        </Banner>
      )}

      {error && <Banner tone="error">{error}</Banner>}

      <div className="flex flex-col xl:flex-row gap-6">
        {/* Floor plan */}
        <div
          className={`flex-1 min-w-0 ${
            expanded || mobileView === "plan" ? "" : "hidden xl:block"
          }`}
        >
          <div className="bg-white rounded-xl border border-sage/30 p-3 relative">
            {/* Zoom controls. Buttons as well as pinch, because a trackpad
                pinch is awkward and a mouse has no pinch at all. */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
              <CanvasButton
                onClick={() => zoomByFactor(1 / 1.4)}
                disabled={atFitZoom}
                label="Zoom out"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </CanvasButton>
              <CanvasButton onClick={() => zoomByFactor(1.4)} label="Zoom in">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </CanvasButton>
              <CanvasButton
                onClick={() => setView(FIT_VIEW)}
                disabled={atFitZoom}
                label="Fit the whole tent"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                />
              </CanvasButton>
              <CanvasButton
                onClick={() => setExpanded((v) => !v)}
                label={
                  expanded ? "Exit full screen (Esc)" : "Expand to full window"
                }
              >
                {expanded ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4.5 4.5h6m-6 0v6m0-6l6.75 6.75M19.5 19.5h-6m6 0v-6m0 6l-6.75-6.75"
                  />
                )}
              </CanvasButton>
            </div>
            <svg
              ref={svgRef}
              viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
              // In expanded mode the plan should fill the viewport height.
              // preserveAspectRatio (default xMidYMid meet) keeps the tent
              // centered and undistorted inside whatever box it gets.
              className={`w-full h-auto touch-none select-none ${
                expanded ? "max-h-[calc(100vh-11rem)]" : ""
              } ${atFitZoom ? "" : "cursor-move"}`}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={endCanvasPointer}
              onPointerCancel={endCanvasPointer}
              onPointerLeave={endCanvasPointer}
            >
              {/* 5ft grid */}
              <defs>
                <pattern
                  id="grid5"
                  width="5"
                  height="5"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M 5 0 L 0 0 0 5"
                    fill="none"
                    stroke="#C5D0B3"
                    strokeWidth="0.06"
                    opacity="0.5"
                  />
                </pattern>
              </defs>

              <rect
                x="0"
                y="0"
                width={TENT_WIDTH_FT}
                height={TENT_DEPTH_FT}
                fill="url(#grid5)"
                stroke="#5C6B4E"
                strokeWidth="0.25"
                rx="0.5"
              />

              {/* Dimension labels */}
              <text
                x={TENT_WIDTH_FT / 2}
                y={-0.9}
                textAnchor="middle"
                fontSize="1.6"
                fill="#5C6B4E"
              >
                {TENT_WIDTH_FT}&prime;
              </text>
              <text
                x={-1.2}
                y={TENT_DEPTH_FT / 2}
                textAnchor="middle"
                fontSize="1.6"
                fill="#5C6B4E"
                transform={`rotate(-90 ${-1.2} ${TENT_DEPTH_FT / 2})`}
              >
                {TENT_DEPTH_FT}&prime;
              </text>

              {localObjects.map((obj) => (
                <FloorObjectShape
                  key={obj.id}
                  obj={obj}
                  isSelected={selectedIds.has(obj.id)}
                  isCrowded={crowded.has(obj.id)}
                  dropSeat={
                    dropTarget?.objectId === obj.id
                      ? (dropTarget.seatNumber ?? "table")
                      : null
                  }
                  assignments={assignmentsByObject.get(obj.id) ?? []}
                  occupantBySeat={occupantBySeat}
                  onPointerDown={(e) => handlePointerDown(e, obj)}
                  onPointerMove={(e) => handlePointerMove(e, obj)}
                  onPointerUp={(e) => handlePointerUp(e, obj)}
                />
              ))}
            </svg>
          </div>

          {/* Floor plan controls */}
          <div className="flex flex-wrap gap-2 mt-3">
            <SmallButton onClick={() => run(addRoundTable)} disabled={isPending}>
              + Round table
            </SmallButton>
            <SmallButton onClick={() => run(addHeadTable)} disabled={isPending}>
              + Head table
            </SmallButton>
            {roundTableCount === 0 && (
              <SmallButton
                onClick={() =>
                  run(() =>
                    generateRoundTables(
                      Math.min(
                        Math.ceil(guests.length / DEFAULT_SEAT_COUNT),
                        MAX_ROUND_TABLES
                      )
                    )
                  )
                }
                disabled={isPending}
                primary
              >
                Generate{" "}
                {Math.min(
                  Math.ceil(guests.length / DEFAULT_SEAT_COUNT),
                  MAX_ROUND_TABLES
                )}{" "}
                tables for {guests.length} guests
              </SmallButton>
            )}
            <span className="text-xs text-dark/50 self-center ml-1">
              Shift-click to select several &middot; Delete removes them &middot;
              tent fits {MAX_ROUND_TABLES} tables at {ROUND_TABLE_FOOTPRINT_FT}
              &prime; spacing
            </span>
          </div>
        </div>

        {/* Side panel */}
        <div
          className={`w-full xl:w-[26rem] shrink-0 ${
            expanded || mobileView === "plan" ? "" : "hidden xl:block"
          }`}
        >
          {selectedObjects.length > 1 ? (
            <MultiSelectPanel
              objects={selectedObjects}
              assignmentsByObject={assignmentsByObject}
              isPending={isPending}
              onDeselect={() => setSelectedIds(new Set())}
              onSetSeats={(n) =>
                run(() =>
                  updateSeatCounts(
                    selectedObjects
                      .filter((o) => o.kind === "round_table")
                      .map((o) => o.id),
                    n
                  )
                )
              }
              onClear={() => {
                const ids = new Set(selectedObjects.map((o) => o.id));
                optimistic(
                  (prev) => prev.filter((a) => !ids.has(a.object_id)),
                  async () => {
                    // No bulk clear action: clearing is rare enough that
                    // reusing the single-table path is fine. Only the last
                    // result matters, since each one snapshots.
                    let last: MutationResult = {};
                    for (const id of ids) last = await clearTable(id);
                    return last;
                  }
                );
              }}
              onDelete={() => {
                const ids = selectedObjects.map((o) => o.id);
                const seated = ids.reduce(
                  (sum, id) => sum + (assignmentsByObject.get(id) ?? []).length,
                  0
                );
                if (
                  seated > 0 &&
                  !window.confirm(
                    `Delete ${ids.length} tables? ${seated} ${seated === 1 ? "person" : "people"} seated there will go back to unseated.`
                  )
                ) {
                  return;
                }
                setSelectedIds(new Set());
                run(() => deleteObjects(ids));
              }}
            />
          ) : selected ? (
            <TablePanel
              obj={selected}
              assignments={assignmentsByObject.get(selected.id) ?? []}
              occupantBySeat={occupantBySeat}
              guestById={guestById}
              unseated={unseated}
              guests={guests}
              assignmentByGuest={assignmentByGuest}
              objectById={objectById}
              flashGuestId={flashGuestId}
              search={search}
              onSearch={setSearch}
              targetSeat={targetSeat}
              onTargetSeat={setTargetSeat}
              onAssign={handleAssign}
              onUnassign={(guestId) =>
                optimistic(
                  (prev) => prev.filter((a) => a.guest_id !== guestId),
                  () => unassignSeat(guestId)
                )
              }
              onSeatParty={(partyId) => handleSeatParty(partyId, selected)}
              onDragStart={beginPersonDrag}
              didDrag={() => didDragRef.current}
              onSwapSeats={(a, b) => handleSwapSeats(selected.id, a, b)}
              onUpdate={(patch) => run(() => updateObject(selected.id, patch))}
              onClear={() =>
                optimistic(
                  (prev) => prev.filter((a) => a.object_id !== selected.id),
                  () => clearTable(selected.id)
                )
              }
              onDelete={() => {
                // The keyboard path has always confirmed this; the button had
                // not, which is how a table of eight went away in one click.
                const seated = (assignmentsByObject.get(selected.id) ?? []).length;
                if (
                  seated > 0 &&
                  !window.confirm(
                    `Delete ${selected.label}? ${seated} ${seated === 1 ? "person" : "people"} seated there will go back to unseated.`
                  )
                ) {
                  return;
                }
                setSelectedIds(new Set());
                run(() => deleteObject(selected.id));
              }}
              isPending={isPending}
            />
          ) : (
            <GuestPanel
              unseated={unseated}
              guests={guests}
              assignmentByGuest={assignmentByGuest}
              objectById={objectById}
              search={search}
              onSearch={setSearch}
              onDragStart={beginPersonDrag}
              onReveal={revealGuest}
            />
          )}
        </div>
      </div>

      {/* Phone and tablet: the same chart as a tap-driven list. Hidden at xl,
          where the plan and its panel are both already on screen. */}
      <div
        className={
          !expanded && mobileView === "list" ? "xl:hidden" : "hidden"
        }
      >
        <SeatingMobileList
          objects={localObjects}
          assignmentsByObject={assignmentsByObject}
          occupantBySeat={occupantBySeat}
          guestById={guestById}
          guests={guests}
          unseated={unseated}
          assignmentByGuest={assignmentByGuest}
          onSeatGuest={handleSeatGuestAt}
          onSeatParty={handleSeatParty}
          onUnassign={(guestId) =>
            optimistic(
              (prev) => prev.filter((a) => a.guest_id !== guestId),
              () => unassignSeat(guestId)
            )
          }
          isPending={isPending}
        />
      </div>
    </div>
  );
}

/** One table or head table on the floor plan. */
function FloorObjectShape({
  obj,
  isSelected,
  isCrowded,
  dropSeat,
  assignments,
  occupantBySeat,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  obj: FloorObject;
  isSelected: boolean;
  isCrowded: boolean;
  /** Seat number under a drag, "table" for the table body, null for neither. */
  dropSeat: number | "table" | null;
  assignments: SeatedGuest[];
  occupantBySeat: Map<string, AttendingGuest>;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  const seatOffsets = seatOffsetsFor(obj);
  const filled = assignments.length;
  const isRound = obj.kind === "round_table";
  const diameter = obj.diameter_ft ?? ROUND_TABLE_DIAMETER_FT;
  const width = obj.width_ft ?? HEAD_TABLE_WIDTH_FT;
  const depth = obj.height_ft ?? HEAD_TABLE_DEPTH_FT;

  const isDropTarget = dropSeat !== null;
  const stroke = isDropTarget
    ? "#D9739F"
    : isCrowded
      ? "#C2410C"
      : isSelected
        ? "#5C6B4E"
        : "#C5D0B3";

  return (
    <g
      transform={`translate(${obj.x_ft} ${obj.y_ft}) rotate(${obj.rotation_deg})`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ cursor: "grab" }}
    >
      {/* Footprint ring: the space this table actually consumes once chairs
          are pulled out. Only drawn when selected, to avoid visual noise. */}
      {isSelected && isRound && (
        <circle
          r={ROUND_TABLE_FOOTPRINT_FT / 2}
          fill="none"
          stroke="#5C6B4E"
          strokeWidth="0.1"
          strokeDasharray="0.6 0.5"
          opacity="0.6"
        />
      )}

      {/* Seat markers, with the occupant's initials */}
      {seatOffsets.map((offset, i) => {
        const seatNumber = i + 1;
        const occupant = occupantBySeat.get(`${obj.id}:${seatNumber}`);
        return (
          <g key={seatNumber}>
            <circle
              cx={offset.x}
              cy={offset.y}
              r={dropSeat === seatNumber ? "0.9" : "0.72"}
              fill={
                dropSeat === seatNumber
                  ? "#D9739F"
                  : occupant
                    ? "#F8BBDB"
                    : "#FAF5EE"
              }
              stroke={
                dropSeat === seatNumber
                  ? "#5C6B4E"
                  : occupant
                    ? "#5C6B4E"
                    : "#C5D0B3"
              }
              strokeWidth={dropSeat === seatNumber ? "0.16" : "0.09"}
            />
            {occupant && (
              <text
                x={offset.x}
                y={offset.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="0.62"
                fontWeight="600"
                fill="#2A2A2A"
                // Counter-rotate so initials stay upright on a rotated table.
                transform={
                  obj.rotation_deg
                    ? `rotate(${-obj.rotation_deg} ${offset.x} ${offset.y})`
                    : undefined
                }
                style={{ pointerEvents: "none" }}
              >
                {initialsFor(occupant)}
              </text>
            )}
          </g>
        );
      })}

      {/* Table body */}
      {isRound ? (
        <circle
          r={diameter / 2}
          fill="#FFFFFF"
          stroke={stroke}
          strokeWidth={isDropTarget || isSelected || isCrowded ? "0.32" : "0.16"}
        />
      ) : (
        <rect
          x={-width / 2}
          y={-depth / 2}
          width={width}
          height={depth}
          rx="0.3"
          fill="#FFFFFF"
          stroke={stroke}
          strokeWidth={isDropTarget || isSelected ? "0.32" : "0.16"}
        />
      )}

      {/* Label and fill count, counter-rotated so text stays upright */}
      <g transform={`rotate(${-obj.rotation_deg})`}>
        <text
          textAnchor="middle"
          y={obj.internal_name ? -0.6 : isRound ? -0.3 : -0.1}
          fontSize={isRound ? "1.25" : "1"}
          fontWeight="600"
          fill="#2A2A2A"
          style={{ pointerEvents: "none" }}
        >
          {obj.label}
        </text>
        {obj.internal_name && (
          <text
            textAnchor="middle"
            y={isRound ? 0.95 : 0.95}
            fontSize="0.72"
            fill="#5C6B4E"
            style={{ pointerEvents: "none" }}
          >
            {truncateForPlan(obj.internal_name)}
          </text>
        )}
        <text
          textAnchor="middle"
          y={obj.internal_name ? 2.1 : isRound ? 1.2 : 1.1}
          fontSize="1"
          fill={filled >= obj.seat_count ? "#5C6B4E" : "#2A2A2A"}
          opacity="0.65"
          style={{ pointerEvents: "none" }}
        >
          {filled}/{obj.seat_count}
        </text>
      </g>
    </g>
  );
}

/** Panel shown when a table is selected: edit it and seat people at it. */
function TablePanel({
  obj,
  assignments,
  occupantBySeat,
  guestById,
  unseated,
  guests,
  assignmentByGuest,
  objectById,
  flashGuestId,
  search,
  onSearch,
  targetSeat,
  onTargetSeat,
  onAssign,
  onUnassign,
  onSeatParty,
  onDragStart,
  didDrag,
  onSwapSeats,
  onUpdate,
  onClear,
  onDelete,
  isPending,
}: {
  obj: FloorObject;
  assignments: SeatedGuest[];
  occupantBySeat: Map<string, AttendingGuest>;
  guestById: Map<string, AttendingGuest>;
  unseated: AttendingGuest[];
  guests: AttendingGuest[];
  assignmentByGuest: Map<string, SeatedGuest>;
  objectById: Map<string, FloorObject>;
  flashGuestId: string | null;
  search: string;
  onSearch: (v: string) => void;
  targetSeat: number | null;
  onTargetSeat: (n: number | null) => void;
  onAssign: (guest: AttendingGuest) => void;
  onUnassign: (guestId: string) => void;
  onSeatParty: (partyId: string) => void;
  onDragStart: (e: React.PointerEvent, payload: DragPayload) => void;
  didDrag: () => boolean;
  onSwapSeats: (seatA: number, seatB: number) => void;
  onUpdate: (patch: {
    label?: string;
    internal_name?: string | null;
    seat_count?: number;
  }) => void;
  onClear: () => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [labelDraft, setLabelDraft] = useState(obj.label);
  useEffect(() => setLabelDraft(obj.label), [obj.id, obj.label]);

  const [internalDraft, setInternalDraft] = useState(obj.internal_name ?? "");
  useEffect(
    () => setInternalDraft(obj.internal_name ?? ""),
    [obj.id, obj.internal_name]
  );

  // Typed seat count, kept as a string so the field can be empty mid-edit
  // rather than snapping to 0 the moment you clear it to type "12".
  const [seatDraft, setSeatDraft] = useState(String(obj.seat_count));
  const [seatDraftError, setSeatDraftError] = useState<string | null>(null);
  useEffect(() => {
    setSeatDraft(String(obj.seat_count));
    setSeatDraftError(null);
  }, [obj.id, obj.seat_count]);

  // ---- reordering people between chairs -------------------------------
  //
  // Rows carry their seat number in a data attribute and the drop target is
  // resolved with elementFromPoint, so the pointer can travel over any part
  // of a row (name, party, the remove button) and still resolve correctly.
  const [dragSeat, setDragSeat] = useState<number | null>(null);
  const [overSeat, setOverSeat] = useState<number | null>(null);
  const seatDragRef = useRef<{ seat: number; x: number; y: number } | null>(
    null
  );
  const seatMovedRef = useRef(false);

  function seatUnderPointer(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y);
    const row = el?.closest<HTMLElement>("[data-seat]");
    if (!row) return null;
    const n = Number(row.dataset.seat);
    return Number.isInteger(n) ? n : null;
  }

  function beginSeatDrag(e: React.PointerEvent, seat: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    seatDragRef.current = { seat, x: e.clientX, y: e.clientY };
    seatMovedRef.current = false;
  }

  // Bound unconditionally. Gating this on "a drag is in progress" was a
  // chicken-and-egg bug: the listeners that START a drag were never attached,
  // because no drag was in progress yet. The handlers no-op when idle, which
  // costs nothing.
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = seatDragRef.current;
      if (!d) return;
      if (
        !seatMovedRef.current &&
        Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_THRESHOLD_PX
      ) {
        return;
      }
      seatMovedRef.current = true;
      setDragSeat(d.seat);
      setOverSeat(seatUnderPointer(e.clientX, e.clientY));
    }

    function onUp(e: PointerEvent) {
      const d = seatDragRef.current;
      seatDragRef.current = null;
      const moved = seatMovedRef.current;
      seatMovedRef.current = false;
      setDragSeat(null);
      setOverSeat(null);
      if (!d || !moved) return;
      const target = seatUnderPointer(e.clientX, e.clientY);
      if (target !== null && target !== d.seat) onSwapSeats(d.seat, target);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onSwapSeats]);

  function commitSeatDraft() {
    const parsed = Number(seatDraft);
    if (!Number.isInteger(parsed)) {
      setSeatDraft(String(obj.seat_count));
      setSeatDraftError(null);
      return;
    }
    if (parsed < MIN_HEAD_TABLE_SEATS || parsed > MAX_HEAD_TABLE_SEATS) {
      // Say what the limit is instead of silently clamping, so a typed 20
      // doesn't quietly become 12.
      setSeatDraftError(
        `${MIN_HEAD_TABLE_SEATS}-${MAX_HEAD_TABLE_SEATS} only`
      );
      setSeatDraft(String(obj.seat_count));
      return;
    }
    setSeatDraftError(null);
    if (parsed !== obj.seat_count) onUpdate({ seat_count: parsed });
  }

  const freeSeatCount =
    obj.seat_count -
    assignments.filter((a) => a.seat_number !== null).length;

  const unnumbered = assignments.filter((a) => a.seat_number === null);

  const filteredUnseated = useMemo(
    () => unseated.filter((g) => guestMatches(g, search)),
    [unseated, search]
  );

  // Group the unseated list by party, since that's how you actually seat.
  const parties = useMemo(() => {
    const map = new Map<string, { name: string; guests: AttendingGuest[] }>();
    for (const g of filteredUnseated) {
      const entry = map.get(g.party_id) ?? { name: g.party_name, guests: [] };
      entry.guests.push(g);
      map.set(g.party_id, entry);
    }
    return [...map.entries()].sort((a, b) =>
      a[1].name.localeCompare(b[1].name)
    );
  }, [filteredUnseated]);

  /**
   * Search matches who are already sitting somewhere else.
   *
   * Only shown once you've typed. This panel used to offer the unseated and
   * nothing else, so moving someone from Table 3 to Table 9 meant unseating
   * them first and then finding them again in a list of 200.
   */
  const seatedElsewhere = useMemo(() => {
    if (!search.trim()) return [];
    return searchPlacements(guests, assignmentByGuest, objectById, search).filter(
      (p) => p.object !== null && p.object.id !== obj.id
    );
  }, [guests, assignmentByGuest, objectById, search, obj.id]);

  return (
    <div className="bg-white rounded-xl border border-sage/30 p-4 space-y-4">
      {/* Table settings */}
      <div className="space-y-3">
        <div>
          <label className="text-xs text-dark/50 block mb-1">
            Table name{" "}
            <span className="text-dark/35">(guests see this)</span>
          </label>
          <input
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={() => {
              if (labelDraft.trim() && labelDraft !== obj.label) {
                onUpdate({ label: labelDraft });
              }
            }}
            className="w-full px-3 py-2 rounded-lg border border-sage/50 text-dark text-sm focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink"
          />
        </div>

        <div>
          <label className="text-xs text-dark/50 block mb-1">
            Group <span className="text-dark/35">(just for you two)</span>
          </label>
          <input
            value={internalDraft}
            onChange={(e) => setInternalDraft(e.target.value)}
            onBlur={() => {
              if (internalDraft !== (obj.internal_name ?? "")) {
                onUpdate({ internal_name: internalDraft });
              }
            }}
            placeholder="UNC friends, work friends, Kayla's cousins..."
            className="w-full px-3 py-2 rounded-lg border border-sage/50 text-dark text-sm placeholder:text-dark/30 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink"
          />
        </div>

        {obj.kind === "round_table" ? (
          <div>
            <label className="text-xs text-dark/50 block mb-1">Seats</label>
            <div className="flex gap-2">
              {[DEFAULT_SEAT_COUNT, MAX_SEAT_COUNT].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onUpdate({ seat_count: n })}
                  disabled={isPending}
                  className={`px-4 py-1.5 rounded-lg text-sm border transition-colors ${
                    obj.seat_count === n
                      ? "bg-pink/30 border-pink text-dark font-medium"
                      : "border-sage/50 text-dark/70 hover:bg-sage/10"
                  }`}
                >
                  {n}
                  {n === MAX_SEAT_COUNT && (
                    <span className="text-xs text-dark/50"> (tight)</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Head tables run anywhere from a sweetheart table for two to the
          // whole wedding party, so this is a stepper rather than a couple of
          // preset buttons.
          <div>
            <label className="text-xs text-dark/50 block mb-1">Seats</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdate({ seat_count: obj.seat_count - 1 })
                }
                disabled={isPending || obj.seat_count <= MIN_HEAD_TABLE_SEATS}
                aria-label="Remove a seat"
                className="w-8 h-8 rounded-lg border border-sage/50 text-dark/70 hover:bg-sage/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                &minus;
              </button>
              <input
                type="number"
                min={MIN_HEAD_TABLE_SEATS}
                max={MAX_HEAD_TABLE_SEATS}
                value={seatDraft}
                onChange={(e) => setSeatDraft(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={commitSeatDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                  if (e.key === "Escape") {
                    setSeatDraft(String(obj.seat_count));
                    e.currentTarget.blur();
                  }
                }}
                aria-label="Number of seats"
                className="w-12 px-1 py-1 text-center text-sm font-medium text-dark rounded-lg border border-sage/50 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink"
              />
              {seatDraftError && (
                <span className="text-xs text-orange-700">
                  {seatDraftError}
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  onUpdate({ seat_count: obj.seat_count + 1 })
                }
                disabled={isPending || obj.seat_count >= MAX_HEAD_TABLE_SEATS}
                aria-label="Add a seat"
                className="w-8 h-8 rounded-lg border border-sage/50 text-dark/70 hover:bg-sage/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                +
              </button>
              <span className="text-xs text-dark/50 ml-1">
                {headTableWidthFor(obj.seat_count)}&prime; table
              </span>
            </div>
            {obj.seat_count >= MAX_HEAD_TABLE_SEATS && (
              <p className="text-xs text-dark/40 mt-1">
                Max {MAX_HEAD_TABLE_SEATS}. Add a second head table for more.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Seats */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-deep-sage">Seats</h3>
          <span className="text-xs text-dark/50">
            {obj.seat_count - freeSeatCount}/{obj.seat_count} filled
            {obj.seat_count - freeSeatCount > 1 && (
              <span className="text-dark/35"> &middot; drag to reorder</span>
            )}
          </span>
        </div>
        <div className="space-y-1">
          {Array.from({ length: obj.seat_count }, (_, i) => i + 1).map((n) => {
            const occupant = occupantBySeat.get(`${obj.id}:${n}`);
            const isTarget = targetSeat === n;
            // Set when you jumped here from a search result, so you can spot
            // which of eight names you were actually looking for.
            const isFlashed = Boolean(occupant && occupant.id === flashGuestId);
            return (
              <div
                key={n}
                data-seat={n}
                onPointerDown={
                  occupant ? (e) => beginSeatDrag(e, n) : undefined
                }
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-sm transition-colors ${
                  overSeat === n && dragSeat !== null && dragSeat !== n
                    ? "border-pink bg-pink/25"
                    : isFlashed
                      ? "border-deep-sage bg-sage/25"
                      : isTarget
                        ? "border-pink bg-pink/10"
                        : "border-transparent hover:bg-sage/5"
                } ${dragSeat === n ? "opacity-40" : ""} ${
                  occupant ? "cursor-grab select-none touch-none" : ""
                }`}
              >
                <span className="w-5 text-xs text-dark/40 shrink-0">{n}</span>
                {occupant ? (
                  <>
                    <span className="flex-1 min-w-0 truncate text-dark">
                      {occupant.first_name} {occupant.last_name}
                      <span className="text-dark/40 text-xs">
                        {" "}
                        &middot; {occupant.party_name}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onUnassign(occupant.id)}
                      disabled={isPending}
                      className="text-dark/30 hover:text-red-600 transition-colors shrink-0 px-1"
                      aria-label={`Remove ${occupant.first_name} from seat ${n}`}
                    >
                      &times;
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => onTargetSeat(isTarget ? null : n)}
                    className="flex-1 text-left text-dark/35 hover:text-deep-sage transition-colors"
                  >
                    {isTarget ? "Choose a guest below" : "Empty"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {unnumbered.length > 0 && (
          <div className="mt-2 pt-2 border-t border-sage/20">
            <p className="text-xs text-dark/50 mb-1">At table, chair TBD</p>
            {unnumbered.map((a) => {
              const guest = guestById.get(a.guest_id);
              if (!guest) return null;
              return (
                <div key={a.guest_id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate text-dark">
                    {guest.first_name} {guest.last_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUnassign(guest.id)}
                    className="text-dark/30 hover:text-red-600 px-1"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Guest picker */}
      <div>
        <h3 className="text-sm font-medium text-deep-sage mb-2">
          {targetSeat
            ? `Seat someone in chair ${targetSeat}`
            : `Add to ${obj.label}`}
        </h3>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          type="search"
          placeholder="Search anyone, seated or not..."
          className="w-full px-3 py-2 mb-2 rounded-lg border border-sage/50 text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink"
        />

        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
          {parties.length === 0 && seatedElsewhere.length === 0 ? (
            <p className="text-sm text-dark/40 py-2">
              {search.trim() ? "Nobody matches that." : "Everyone is seated."}
            </p>
          ) : (
            parties.map(([partyId, party]) => (
              <div
                key={partyId}
                className="border border-sage/20 rounded-lg px-2 py-1.5"
              >
                {/* The whole party row is the primary action, not a small
                    link at the end of it. Nearly every party sits together,
                    so seating the group should be the easy click and picking
                    off individuals the exception. */}
                {(() => {
                  const size = party.guests.length;
                  const fits = size <= freeSeatCount;
                  return (
                    <button
                      type="button"
                      onPointerDown={(e) =>
                        onDragStart(e, {
                          kind: "party",
                          partyId,
                          name: party.name,
                          count: size,
                        })
                      }
                      onClick={() => {
                        if (didDrag()) return;
                        onSeatParty(partyId);
                      }}
                      disabled={isPending || !fits}
                      title={
                        fits
                          ? `Seat all ${size} at this table`
                          : `Only ${freeSeatCount} seat${freeSeatCount === 1 ? "" : "s"} free, this party needs ${size}`
                      }
                      className="w-full flex items-center justify-between gap-2 mb-1 px-1 py-0.5 rounded text-left hover:bg-sage/15 disabled:opacity-45 disabled:hover:bg-transparent transition-colors touch-none select-none cursor-grab"
                    >
                      <span className="text-xs text-dark/60 truncate font-medium">
                        {party.name}
                      </span>
                      <span className="text-xs text-deep-sage shrink-0">
                        {fits
                          ? size > 1
                            ? `Seat all ${size}`
                            : "Seat"
                          : `needs ${size}`}
                      </span>
                    </button>
                  );
                })()}
                {party.guests.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onPointerDown={(e) =>
                      onDragStart(e, { kind: "guest", guest: g })
                    }
                    onClick={() => {
                      if (didDrag()) return;
                      onAssign(g);
                    }}
                    disabled={isPending || freeSeatCount === 0}
                    className="w-full text-left px-2 py-1 rounded text-sm text-dark hover:bg-pink/15 disabled:opacity-40 disabled:hover:bg-transparent transition-colors touch-none select-none cursor-grab"
                  >
                    {g.first_name} {g.last_name}
                  </button>
                ))}
              </div>
            ))
          )}

          {seatedElsewhere.length > 0 && (
            <div className="border border-sage/20 rounded-lg px-2 py-1.5">
              <p className="text-xs text-dark/55 font-medium px-1 pb-1">
                Seated elsewhere &middot; click to move here
              </p>
              {seatedElsewhere.slice(0, 15).map(({ guest, object, seatNumber }) => (
                <button
                  key={guest.id}
                  type="button"
                  onClick={() => onAssign(guest)}
                  disabled={isPending || freeSeatCount === 0}
                  title={
                    freeSeatCount === 0
                      ? `${obj.label} is full`
                      : `Move ${guest.first_name} ${guest.last_name} to ${obj.label}`
                  }
                  className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-left text-sm text-dark hover:bg-pink/15 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                >
                  <span className="truncate">
                    {guest.first_name} {guest.last_name}
                  </span>
                  <span className="text-xs text-dark/45 shrink-0">
                    {object?.label}
                    {seatNumber ? ` · seat ${seatNumber}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Destructive actions */}
      <div className="flex gap-3 pt-3 border-t border-sage/20">
        <button
          type="button"
          onClick={onClear}
          disabled={isPending || assignments.length === 0}
          className="text-xs text-dark/50 hover:text-deep-sage disabled:opacity-40 transition-colors"
        >
          Clear table
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="text-xs text-dark/50 hover:text-red-600 transition-colors"
        >
          Delete table
        </button>
      </div>
    </div>
  );
}

/**
 * Panel for a multi-selection. Deliberately narrow: the things that make
 * sense to do to several tables at once, and nothing else. Seating a specific
 * person needs one table, so that UI stays in the single-table panel.
 */
function MultiSelectPanel({
  objects,
  assignmentsByObject,
  onSetSeats,
  onClear,
  onDelete,
  onDeselect,
  isPending,
}: {
  objects: FloorObject[];
  assignmentsByObject: Map<string, SeatedGuest[]>;
  onSetSeats: (n: number) => void;
  onClear: () => void;
  onDelete: () => void;
  onDeselect: () => void;
  isPending: boolean;
}) {
  const rounds = objects.filter((o) => o.kind === "round_table");
  const seated = objects.reduce(
    (sum, o) => sum + (assignmentsByObject.get(o.id) ?? []).length,
    0
  );
  const seats = objects.reduce((sum, o) => sum + o.seat_count, 0);

  return (
    <div className="bg-white rounded-xl border border-sage/30 p-4 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-deep-sage">
            {objects.length} tables selected
          </h3>
          <p className="text-xs text-dark/50 mt-0.5">
            {seated} of {seats} seats filled &middot; drag any one to move them
            all
          </p>
        </div>
        <button
          type="button"
          onClick={onDeselect}
          className="text-xs text-dark/50 hover:text-deep-sage transition-colors shrink-0"
        >
          Deselect
        </button>
      </div>

      <div className="max-h-40 overflow-y-auto text-sm text-dark/70 space-y-0.5 pr-1">
        {objects.map((o) => (
          <div key={o.id} className="flex justify-between gap-2">
            <span className="truncate">{o.label}</span>
            <span className="text-dark/40 shrink-0">
              {(assignmentsByObject.get(o.id) ?? []).length}/{o.seat_count}
            </span>
          </div>
        ))}
      </div>

      {rounds.length > 0 && (
        <div>
          <label className="text-xs text-dark/50 block mb-1">
            Seats per round table ({rounds.length} of {objects.length})
          </label>
          <div className="flex gap-2">
            {[DEFAULT_SEAT_COUNT, MAX_SEAT_COUNT].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onSetSeats(n)}
                disabled={isPending}
                className="px-4 py-1.5 rounded-lg text-sm border border-sage/50 text-dark/70 hover:bg-sage/10 disabled:opacity-40 transition-colors"
              >
                {n}
                {n === MAX_SEAT_COUNT && (
                  <span className="text-xs text-dark/50"> (tight)</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-3 border-t border-sage/20">
        <button
          type="button"
          onClick={onClear}
          disabled={isPending || seated === 0}
          className="text-xs text-dark/50 hover:text-deep-sage disabled:opacity-40 transition-colors"
        >
          Clear {objects.length} tables
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="text-xs text-dark/50 hover:text-red-600 transition-colors"
        >
          Delete {objects.length} tables
        </button>
      </div>
    </div>
  );
}

/**
 * Panel shown when no table is selected.
 *
 * Two jobs, and which one you get depends on whether the box is empty. Empty,
 * it's the unseated list: who still needs a chair, grouped by party, draggable
 * onto the plan. Typed in, it answers "where is this person sitting?" across
 * everyone, which nothing on the page could do before: once a guest had a
 * chair they disappeared from the only search there was.
 */
function GuestPanel({
  unseated,
  guests,
  assignmentByGuest,
  objectById,
  search,
  onSearch,
  onDragStart,
  onReveal,
}: {
  unseated: AttendingGuest[];
  guests: AttendingGuest[];
  assignmentByGuest: Map<string, SeatedGuest>;
  objectById: Map<string, FloorObject>;
  search: string;
  onSearch: (v: string) => void;
  onDragStart: (e: React.PointerEvent, payload: DragPayload) => void;
  onReveal: (objectId: string, guestId: string) => void;
}) {
  const isSearching = search.trim().length > 0;

  const results = useMemo(
    () => searchPlacements(guests, assignmentByGuest, objectById, search),
    [guests, assignmentByGuest, objectById, search]
  );

  const parties = useMemo(() => {
    const map = new Map<string, { name: string; guests: AttendingGuest[] }>();
    for (const g of unseated) {
      const entry = map.get(g.party_id) ?? { name: g.party_name, guests: [] };
      entry.guests.push(g);
      map.set(g.party_id, entry);
    }
    return [...map.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [unseated]);

  const seatedCount = results.filter((r) => r.object).length;

  return (
    <div className="bg-white rounded-xl border border-sage/30 p-4">
      <h3 className="text-sm font-medium text-deep-sage mb-1">
        {isSearching ? `Search (${results.length})` : `Not seated yet (${unseated.length})`}
      </h3>
      <p className="text-xs text-dark/50 mb-3">
        {isSearching
          ? `${seatedCount} seated, ${results.length - seatedCount} not. Click a seated name to jump to their table.`
          : "Drag a name onto a seat, or a party name onto a table. Or click a table to seat people from its panel."}
      </p>
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        type="search"
        placeholder="Search anyone, seated or not..."
        className="w-full px-3 py-2 mb-3 rounded-lg border border-sage/50 text-dark text-sm placeholder:text-dark/40 focus:outline-none focus:ring-2 focus:ring-pink focus:border-pink"
      />

      <div className="max-h-[32rem] overflow-y-auto space-y-2 pr-1">
        {isSearching ? (
          results.length === 0 ? (
            <p className="text-sm text-dark/40">Nobody matches that.</p>
          ) : (
            results.map(({ guest, object, seatNumber }) =>
              object ? (
                <button
                  key={guest.id}
                  type="button"
                  onClick={() => onReveal(object.id, guest.id)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-sage/15 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-dark truncate">
                      {guest.first_name} {guest.last_name}
                    </span>
                    <span className="block text-xs text-dark/40 truncate">
                      {guest.party_name}
                    </span>
                  </span>
                  <span className="text-xs shrink-0 text-right">
                    <span className="block text-deep-sage font-medium">
                      {object.label}
                    </span>
                    <span className="block text-dark/40">
                      {seatNumber ? `seat ${seatNumber}` : "chair TBD"}
                    </span>
                  </span>
                </button>
              ) : (
                // Still draggable: an unseated search hit is something you
                // probably want to put somewhere right now.
                <div
                  key={guest.id}
                  onPointerDown={(e) =>
                    onDragStart(e, { kind: "guest", guest })
                  }
                  title="Drag onto a seat or table"
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg touch-none select-none cursor-grab hover:bg-pink/10 transition-colors"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-dark truncate">
                      {guest.first_name} {guest.last_name}
                    </span>
                    <span className="block text-xs text-dark/40 truncate">
                      {guest.party_name}
                    </span>
                  </span>
                  <span className="text-xs text-orange-700 shrink-0">
                    Not seated
                  </span>
                </div>
              )
            )
          )
        ) : parties.length === 0 ? (
          <p className="text-sm text-dark/40">Everyone has a seat.</p>
        ) : (
          parties.map(([partyId, party]) => (
            <div key={partyId}>
              <p
                onPointerDown={(e) =>
                  onDragStart(e, {
                    kind: "party",
                    partyId,
                    name: party.name,
                    count: party.guests.length,
                  })
                }
                className="text-xs text-dark/50 touch-none select-none cursor-grab hover:text-deep-sage transition-colors"
                title={`Drag the whole party (${party.guests.length}) onto a table`}
              >
                {party.name}
              </p>
              {party.guests.map((g) => (
                <p
                  key={g.id}
                  onPointerDown={(e) =>
                    onDragStart(e, { kind: "guest", guest: g })
                  }
                  className="text-sm text-dark pl-2 touch-none select-none cursor-grab hover:bg-pink/10 rounded transition-colors"
                  title="Drag onto a seat or table"
                >
                  {g.first_name} {g.last_name}
                </p>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Undo/redo controls. Labels name the specific change ("Undo: Seat the Myers
 * party at Table 3") so you know what you're about to reverse, which matters
 * a lot when two admins are editing the same plan.
 */
function UndoRedoBar({
  history,
  onUndo,
  onRedo,
  disabled,
}: {
  history: HistoryState;
  onUndo: () => void;
  onRedo: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onUndo}
        disabled={disabled || !history.canUndo}
        title={
          history.undoLabel
            ? `Undo: ${history.undoLabel}`
            : "Nothing to undo"
        }
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sage/50 text-sm text-dark/80 hover:bg-sage/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3"
          />
        </svg>
        Undo
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={disabled || !history.canRedo}
        title={
          history.redoLabel ? `Redo: ${history.redoLabel}` : "Nothing to redo"
        }
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sage/50 text-sm text-dark/80 hover:bg-sage/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3"
          />
        </svg>
        Redo
      </button>
    </div>
  );
}

/**
 * Autosave status. There is no save button because there is nothing to save:
 * every edit is already written. This tells you that happened, and shouts if
 * a write failed.
 */
function SaveIndicator({
  status,
  history,
}: {
  status: SaveStatus;
  history: HistoryState;
}) {
  if (status === "saving") {
    return <span className="text-xs text-dark/50">Saving...</span>;
  }

  if (status === "error") {
    return (
      <span className="text-xs text-red-700 font-medium">
        Not saved, see the error below
      </span>
    );
  }

  if (status === "saved") {
    return <span className="text-xs text-deep-sage">All changes saved</span>;
  }

  if (history.lastEditedAt) {
    const who = history.lastEditedBy;
    return (
      <span className="text-xs text-dark/40">
        Saved automatically &middot; last edit{" "}
        {new Date(history.lastEditedAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
        {who ? ` by ${who}` : ""}
      </span>
    );
  }

  return (
    <span className="text-xs text-dark/40">Changes save automatically</span>
  );
}

function Stat({
  label,
  value,
  tone = "ok",
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="bg-white rounded-xl border border-sage/30 px-4 py-3">
      <p className="text-xs text-dark/50">{label}</p>
      <p
        className={`text-2xl font-heading ${
          tone === "warn" ? "text-orange-700" : "text-deep-sage"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "warn" | "info" | "error";
  children: React.ReactNode;
}) {
  const styles = {
    warn: "bg-orange-50 border-orange-200 text-orange-900",
    info: "bg-sage/10 border-sage/40 text-deep-sage",
    error: "bg-red-50 border-red-200 text-red-800",
  }[tone];

  return (
    <div className={`mb-3 px-4 py-2.5 rounded-lg border text-sm ${styles}`}>
      {children}
    </div>
  );
}

function SmallButton({
  onClick,
  disabled,
  primary,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors disabled:opacity-50 ${
        primary
          ? "bg-pink text-dark border-pink hover:bg-pink/80 font-medium"
          : "border-sage/50 text-dark/80 hover:bg-sage/10"
      }`}
    >
      {children}
    </button>
  );
}

/** Small icon button floating over the floor plan. */
function CanvasButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="p-2 rounded-lg bg-white/90 border border-sage/40 text-dark/60 hover:text-deep-sage hover:border-sage disabled:opacity-35 disabled:hover:text-dark/60 disabled:hover:border-sage/40 transition-colors"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
      >
        {children}
      </svg>
    </button>
  );
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
