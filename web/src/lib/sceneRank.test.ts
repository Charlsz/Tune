import { describe, expect, it } from "vitest";
import { pickBestPair, rankScenes } from "./sceneRank";
import type { CatalogScene } from "../types";

const aoi: [number, number, number, number] = [-75, 4, -74, 5];

function scene(partial: Partial<CatalogScene> & { id: string }): CatalogScene {
  return {
    datetime: "2022-05-18T10:00:00",
    cloud_cover: 5,
    bbox: [-75.2, 3.8, -73.8, 5.2],
    thumbnail: null,
    ...partial,
  };
}

describe("sceneRank", () => {
  it("prioriza mayor cobertura y menos nubes", () => {
    const ranked = rankScenes(
      [
        scene({ id: "cloudy", cloud_cover: 35, bbox: [-75.2, 3.8, -73.8, 5.2] }),
        scene({ id: "clear", cloud_cover: 2, bbox: [-75.2, 3.8, -73.8, 5.2] }),
        scene({ id: "partial", cloud_cover: 5, bbox: [-74.6, 4.4, -74.4, 4.6] }),
      ],
      aoi,
      40,
    );
    expect(ranked[0].id).toBe("clear");
    expect(ranked.find((s) => s.id === "partial")!.coverage).toBeLessThan(0.5);
    expect(ranked[0].reasons.length).toBeGreaterThan(0);
  });

  it("pickBestPair exige Después posterior a Antes", () => {
    const before = rankScenes(
      [scene({ id: "b", datetime: "2022-05-18T00:00:00", cloud_cover: 1 })],
      aoi,
      40,
    );
    const after = rankScenes(
      [
        scene({ id: "early", datetime: "2022-05-10T00:00:00", cloud_cover: 1 }),
        scene({ id: "late", datetime: "2022-09-05T00:00:00", cloud_cover: 3 }),
      ],
      aoi,
      40,
    );
    const pair = pickBestPair(before, after);
    expect(pair.before?.id).toBe("b");
    expect(pair.after?.id).toBe("late");
  });
});
