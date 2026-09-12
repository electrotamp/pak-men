import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore, setState, updateProject } from '../store.ts';
import { addFavorite, moveFavorite, removeFavorite, sortFavoritesAZ } from '../actions.ts';
import { computeFlow, GRID } from '../preview/flow.ts';
import { useFavArtUrl, useGridArtType } from '../hooks.ts';
import { artCodeForClient } from '../util.ts';
import { libraryEntry } from '../hooks.ts';
import type { Favorite } from '../../shared/types.ts';
import type { ArtType } from '../../shared/enums.ts';

export function GridCanvas() {
  const project = useStore((s) => s.project)!;
  const selected = useStore((s) => s.selected);
  const artType = useGridArtType();
  const square = Boolean(project.settings['menu.grid_square_tiles']);
  const large = Boolean(project.settings['menu.grid_large_tiles']);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1.6, Math.max(0.5, (el.clientWidth - 40) / GRID.visibleW)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const flow = useMemo(
    () => computeFlow(project.favorites.length, { square, large }),
    [project.favorites.length, square, large],
  );
  const stageH = Math.max(
    GRID.visibleH,
    (flow.tiles.at(-1)?.y ?? 0) + (flow.tiles.at(-1)?.h ?? 0) + GRID.labelH + GRID.padY,
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = project.favorites.findIndex((f) => f.sdPath === active.id);
    const to = project.favorites.findIndex((f) => f.sdPath === over.id);
    if (from < 0 || to < 0) return;
    moveFavorite(from, to);
    setState({ selected: to });
  }

  function onDrop(ev: React.DragEvent) {
    ev.preventDefault();
    const sdPath = ev.dataTransfer.getData('text/sdpath');
    if (sdPath) addFavorite(sdPath);
  }

  return (
    <div className="pane" style={{ borderRight: '1px solid var(--line)' }}>
      <div className="pane-head">
        Grid preview
        <span className="pill">{project.favorites.length} tiles</span>
        <span className="spacer" />
        <button onClick={sortFavoritesAZ}>Sort A–Z</button>
        <button
          onClick={() => {
            if (confirm('Clear all favorites?')) updateProject((p) => (p.favorites = []));
          }}
        >
          Clear
        </button>
      </div>
      <div
        className="grid-wrap"
        ref={wrapRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {project.favorites.length === 0 ? (
          <div className="grid-drop-hint">
            Drag games here from the Library (or double-click them) to build your grid.
          </div>
        ) : (
          <div
            className="grid-stage"
            style={{ width: GRID.visibleW * scale, height: stageH * scale }}
          >
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext
                items={project.favorites.map((f) => f.sdPath)}
                strategy={rectSortingStrategy}
              >
                {project.favorites.map((fav, i) => (
                  <Tile
                    key={fav.sdPath}
                    fav={fav}
                    box={flow.tiles[i]!}
                    scale={scale}
                    artType={artType}
                    selected={i === selected}
                    onSelect={() => setState({ selected: i })}
                    onRemove={() => removeFavorite(i)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </div>
    </div>
  );
}

function Tile({
  fav,
  box,
  scale,
  artType,
  selected,
  onSelect,
  onRemove,
}: {
  fav: Favorite;
  box: { x: number; y: number; w: number; h: number };
  scale: number;
  artType: ArtType;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: fav.sdPath,
  });
  const entry = libraryEntry(fav.sdPath);
  const artCode = artCodeForClient(fav.gameCode ?? entry?.gameCode, entry?.special ?? -1);
  const url = useFavArtUrl({ ...fav, gameCode: artCode }, artType);
  const name = entry?.displayName ?? fav.sdPath.split('/').pop();

  return (
    <div
      ref={setNodeRef}
      className={`tile${selected ? ' sel' : ''}${url ? '' : ' placeholder'}`}
      style={{
        left: box.x * scale,
        top: box.y * scale,
        width: box.w * scale,
        height: (box.h + 18) * scale,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault();
        onRemove();
      }}
      {...attributes}
      {...listeners}
    >
      {url ? <img className="art" src={url} alt="" /> : <div className="art">{fav.type === 2 ? '64DD' : 'no art'}</div>}
      <div className="cap">{name}</div>
    </div>
  );
}
