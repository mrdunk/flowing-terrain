#!/usr/bin/env python3

# MIT License
#
# Copyright (c) 2020 duncan law
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

""" Proof of concept implementation of a procedural terrain generation
algorithm which guarantees slopes will always flow downhill to the sea from any
point above sea level.
See https://github.com/mrdunk/flowing-terrain for more detail. """

from typing import Tuple, List, Optional, Generator
import random
import pyglet
from pyglet.gl import GL_TRIANGLES
from sortedcontainers import SortedSet  # pip3 install sortedcontainers

RED = (1, 0, 0)
GREEN = (0, 1, 0)
BLUE = (0, 0, 1)

WINDOW_SIZE = 1000
TILE_SIZE = 6
BORDER = 1
TILE_COUNT = int(WINDOW_SIZE / TILE_SIZE)
JITTER = 3

geography: Optional["Geography"] = None
tiled = False
window = pyglet.window.Window(width=WINDOW_SIZE, height=WINDOW_SIZE, resizable=True)
batch = pyglet.graphics.Batch()

class Enviroment:
    """ State to share across all tiles. """
    highest_point: int = 0
    sealevel: float = 0
    dampest: int = 0


class Tile:
    """ A single landscape segment on the map. """
    pos: Tuple[int, int] = (-1, -1)
    height: int = -1
    dampness: int = 1
    sealevel: int = 0
    highest_point: int = 0
    dampest: int = 100

    def __init__(self, pos: Tuple[int, int], enviroment: Enviroment):
        self.x = pos[0]
        self.y = pos[1]
        self.pos = pos
        self.enviroment: Enviroment = enviroment

    def __lt__(self, other: "Tile") -> bool:
        return id(self) < id(other)

    def draw(self) -> None:
        """ Draw this tile on the 2D map. """
        highlight = False
        if self.height >= self.enviroment.sealevel:
            self.highlight((10.0 * self.dampness / self.enviroment.dampest, 0, 0))
            highlight = True

        if self.height is None:
            colour = RED
        elif self.height < self.enviroment.sealevel:
            colour = (0.5 * float(self.height) / self.enviroment.highest_point,
                      0.5 * float(self.height) / self.enviroment.highest_point,
                      1.0 - float(self.height) / self.enviroment.highest_point)
        else:
            colour = (1.0 - float(self.height) / self.enviroment.highest_point,
                      1.0 - 0.8 * float(self.height) / self.enviroment.highest_point,
                      1.0 - float(self.height) / self.enviroment.highest_point)

        if highlight:
            square(TILE_SIZE - BORDER,
                   (self.x * TILE_SIZE, self.y * TILE_SIZE),
                   colour)
        else:
            square(TILE_SIZE,
                   (self.x * TILE_SIZE, self.y * TILE_SIZE),
                   colour)

    def highlight(self, colour: Tuple[float, float, float]) -> None:
        """ Highlight (outline in specified colour) this tile on the map. """
        square(TILE_SIZE,
               (self.x * TILE_SIZE, self.y * TILE_SIZE),
               colour)


class Geography:
    """ Generate complete set of terrain data. """
    tiles: List[List[Optional[Tile]]] = []
    open_set_sorted = SortedSet()
    enviroment = Enviroment()

    def __init__(self) -> None:
        for _ in range(TILE_COUNT):
            self.tiles.append([None] * TILE_COUNT)
        self._starting_points()
        self.heights_algorithm()
        self.drainage_algorithm()

    def get_tile(self, x: int, y: int) -> Tile:
        """ Retrieve a tile at specified coordinates. """
        tile = self.tiles[x][y]
        if tile is None:
            tile = Tile((x, y), self.enviroment)
            self.tiles[x][y] = tile
        return tile

    def heights_algorithm(self) -> None:
        """ Populate all tiles with height data. Also set the sealevel. """
        while self.open_set_sorted:
            height, tile = self.open_set_sorted.pop(0)
            for neighbour in self.get_neighbours_filtered(tile):
                new_height = height + random.randint(1, JITTER)
                neighbour.height = new_height
                self.open_set_sorted.add((new_height, neighbour))

                if new_height > self.enviroment.highest_point:
                    self.enviroment.highest_point = new_height
        self.enviroment.sealevel = self.enviroment.highest_point / random.uniform(1.5, 4)

    def drainage_algorithm(self) -> None:
        """ Calculate the number of uphill tiles draining into each tile on the
        map. High tile.dampness values indicate a river runs through that tile.
        """
        self.open_set_sorted.clear()
        for x in range(TILE_COUNT):
            for y in range(TILE_COUNT):
                tile = self.get_tile(x, y)
                if tile.height > self.enviroment.sealevel:
                    self.open_set_sorted.add((tile.height, tile))

        self.enviroment.dampest = 0
        while self.open_set_sorted:
            height, tile = self.open_set_sorted.pop()
            lowest_neighbour = None
            for neighbour in self.get_neighbours(tile):
                if neighbour.height < height:
                    if lowest_neighbour is None or lowest_neighbour.height > neighbour.height:
                        lowest_neighbour = neighbour
            assert lowest_neighbour
            lowest_neighbour.dampness += tile.dampness

            if tile.dampness > self.enviroment.dampest:
                self.enviroment.dampest = tile.dampness

    def get_neighbours(self, tile: Tile) -> Generator[Tile, Tile, None]:
        """ Get all tiles adjacent to the specified tile. """
        if tile.x > 0:
            neighbour = self.get_tile(tile.x - 1, tile.y)
            yield neighbour
            if tile.y > 0:
                neighbour = self.get_tile(tile.x - 1, tile.y - 1)
                yield neighbour
            if tile.y < TILE_COUNT - 1:
                neighbour = self.get_tile(tile.x - 1, tile.y + 1)
                yield neighbour
        if tile.x < TILE_COUNT - 1:
            neighbour = self.get_tile(tile.x + 1, tile.y)
            yield neighbour
            if tile.y > 0:
                neighbour = self.get_tile(tile.x + 1, tile.y - 1)
                yield neighbour
            if tile.y < TILE_COUNT - 1:
                neighbour = self.get_tile(tile.x + 1, tile.y + 1)
                yield neighbour
        if tile.y > 0:
            neighbour = self.get_tile(tile.x, tile.y - 1)
            yield neighbour
        if tile.y < TILE_COUNT - 1:
            neighbour = self.get_tile(tile.x, tile.y + 1)
            yield neighbour

    def get_neighbours_filtered(self, tile: Tile) -> Generator[Tile, Tile, None]:
        """ Get all tiles adjacent to the specified tile that have not had their
        height populated yet. """
        for neighbour in self.get_neighbours(tile):
            if neighbour.height < 0:
                yield neighbour

    def _starting_points(self) -> None:
        """ Set seed heights on map to start the height generation algorithm at.
        """
        for x in range(TILE_COUNT):
            start = self.get_tile(x, 0)
            start.height = 0
            if (start.height, start) not in self.open_set_sorted:
                self.open_set_sorted.add((0, start))

            start = self.get_tile(x, TILE_COUNT - 1)
            start.height = 0
            if (start.height, start) not in self.open_set_sorted:
                self.open_set_sorted.add((0, start))
        for y in range(TILE_COUNT):
            start = self.get_tile(0, y)
            start.height = 0
            if (start.height, start) not in self.open_set_sorted:
                self.open_set_sorted.add((0, start))

            start = self.get_tile(TILE_COUNT - 1, y)
            start.height = 0
            if (start.height, start) not in self.open_set_sorted:
                self.open_set_sorted.add((0, start))

        # And a few away from the edges...
        for _ in range(random.randint(0, 30)):
            start = self.get_tile(random.randint(0, TILE_COUNT - 1),
                                  random.randint(0, TILE_COUNT - 1))
            start.height = 0
            if (start.height, start) not in self.open_set_sorted:
                self.open_set_sorted.add((0, start))



def square(size: int,
           pos: Tuple[int, int],
           colour: Tuple[float, float, float]) -> None:
    """ Draw a square to the screen. """
    batch.add_indexed(4,
                      GL_TRIANGLES, None, [0, 1, 2, 0, 2, 3],
                      ('v2f', (pos[1], pos[0],
                               pos[1] + size, pos[0],
                               pos[1] + size, pos[0] + size,
                               pos[1], pos[0] + size)),
                      ('c3f', colour + colour + colour + colour)
                      )


@window.event
def on_draw() -> None:
    """ Pyglet callback which calls all code needed to draw map to screen. """
    global tiled

    if tiled:
        return

    window.clear()

    for x in range(TILE_COUNT):
        for y in range(TILE_COUNT):
            tile = geography.get_tile(x, y)
            tile.draw()
    batch.draw()
    tiled = True

def main() -> None:
    global geography
    geography = Geography()

    print("OpenGL Context: {}".format(window.context.get_info().version))
    pyglet.gl.glClearColor(0.2, 0.3, 0.3, 1)
    pyglet.app.run()


if __name__ == "__main__":
    main()
