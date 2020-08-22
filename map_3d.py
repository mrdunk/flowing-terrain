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

from typing import Tuple, List, Generator, Optional, Dict
import random
import math
from sortedcontainers import SortedSet  # pip3 install sortedcontainers
import pyglet  # pip3 install pyglet
from pyglet.gl import (glClearColor, glEnable, glFogfv, GLfloat, glHint, glFogi,
                       glFogf, glMatrixMode, glLoadIdentity, gluPerspective,
                       glRotatef, glTranslatef, GL_FOG_HINT, GL_DONT_CARE,
                       GL_FOG, GL_FOG_COLOR, GL_FOG_MODE, GL_LINEAR,
                       GL_FOG_START, GL_FOG_END, GL_PROJECTION, GL_MODELVIEW)
from pyglet.window import key

RED = (1, 0, 0)
GREEN = (0, 1, 0)
BLUE = (0, 0, 1)

WINDOW_SIZE = 1000
TILE_SIZE = 6
BORDER = 1
TILE_COUNT = int(WINDOW_SIZE / TILE_SIZE)
JITTER = 3


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
    lowest_neighbour = None

    def __init__(self, pos: Tuple[int, int], enviroment: Enviroment) -> None:
        self.x = pos[0]
        self.y = pos[1]
        self.pos = pos
        self.enviroment: Enviroment = enviroment

    def __lt__(self, other: "Tile") -> bool:
        return id(self) < id(other)

    def get_colour(self) -> Tuple[float, float, float]:
        """ Return colour for this tile. """
        if self.height is None:
            return RED

        #return (1.0 - float(self.height) / self.enviroment.highest_point,
        #        1.0 - 0.8 * float(self.height) / self.enviroment.highest_point,
        #        1.0 - float(self.height) / self.enviroment.highest_point)
        height = self.height - self.enviroment.sealevel
        highest = self.enviroment.highest_point - self.enviroment.sealevel
        val = 1.0 - (height / highest)
        return (val, val, val)


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
        self.generate_mesh()

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
                new_height = height + random.uniform(0, JITTER)
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
            lowest_neighbour: Optional[Tile] = None
            for neighbour in self.get_neighbours(tile):
                if neighbour.height < height:
                    if lowest_neighbour is None or neighbour.height < lowest_neighbour.height:
                        lowest_neighbour = neighbour
            assert lowest_neighbour is not None
            lowest_neighbour.dampness += tile.dampness
            tile.lowest_neighbour = lowest_neighbour

            if lowest_neighbour.dampness > self.enviroment.dampest:
                self.enviroment.dampest = lowest_neighbour.dampness

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

    def generate_mesh(self) -> None:
        """ Generate 3D primitive data for displaying map and store in
        self.batch ready for sending to GPU. """
        self.batch = pyglet.graphics.Batch()

        def draw_tile(tile11: Tile) -> None:
            """ Generate 3D primitive data for a single tile and store in
            self.batch """

            def midpoint(*tiles: Tile) -> Tuple[float, float, float]:
                """ Get mid point between 2 tiles. """
                x = 0
                y = 0
                height = 0.0
                lowest_height = self.enviroment.highest_point + 1
                go_low = False
                for tile in tiles:
                    x += tile.x
                    y += tile.y
                    height += tile.height
                    if tile.height < lowest_height:
                        lowest_height = tile.height
                    if tile.lowest_neighbour in tiles:
                        # A lowest neighbour is joined through this point so
                        # we need to keep it lower than the draining tile.
                        # For simplicities sake, make this point the same height
                        # as the lowest connected tile.
                        go_low = True

                height = height / len(tiles)
                if go_low and height > lowest_height:
                    height = lowest_height
                return (TILE_SIZE * x / len(tiles),
                        TILE_SIZE * y / len(tiles),
                        height)

            def draw_river(a: Tile, mid: Tuple[float, float, float], b: Tile) -> None:
                """ Draw rivers as straight lines between the 2 specified tiles.
                """
                a_vert = (a.x * TILE_SIZE, a.y * TILE_SIZE, a.height + 0.01)
                b_vert = (b.x * TILE_SIZE, b.y * TILE_SIZE, b.height + 0.01)
                mid_vert = (mid[0], mid[1], mid[2] + 0.01)
                vertexes = a_vert + mid_vert
                colors = RED * 2
                self.batch.add(2,
                               pyglet.gl.GL_LINES,
                               None,
                               ("v3f", vertexes),
                               ("c3f", colors))
                vertexes = b_vert + mid_vert
                colors = RED * 2
                self.batch.add(2,
                               pyglet.gl.GL_LINES,
                               None,
                               ("v3f", vertexes),
                               ("c3f", colors))

            x = tile11.x
            y = tile11.y

            tile00 = self.get_tile(x - 1, y - 1)
            tile10 = self.get_tile(x, y - 1)
            tile20 = self.get_tile(x + 1, y - 1)
            tile01 = self.get_tile(x - 1, y)
            #tile11 = tile11
            tile21 = self.get_tile(x + 1, y)
            tile02 = self.get_tile(x - 1, y + 1)
            tile12 = self.get_tile(x, y + 1)
            tile22 = self.get_tile(x + 1, y + 1)

            mid00 = midpoint(tile00, tile10, tile01, tile11)
            mid10 = midpoint(tile10, tile11)
            mid20 = midpoint(tile20, tile10, tile21, tile11)
            mid01 = midpoint(tile01, tile11)
            mid11 = midpoint(tile11, tile11)
            mid21 = midpoint(tile21, tile11)
            mid02 = midpoint(tile02, tile01, tile12, tile11)
            mid12 = midpoint(tile12, tile11)
            mid22 = midpoint(tile22, tile12, tile21, tile11)

            vertexes = mid00 + mid10 + mid20 + mid01 + \
                       mid11 + mid21 + mid02 + mid12 + mid22

            colors = tile11.get_colour() * 9

            indexes = [4, 0, 1, 4, 1, 2, 4, 2, 5, 4, 5, 8, 4, 8, 7, 4, 7, 6, 4, 6, 3, 4, 3, 0]

            self.batch.add_indexed(int(len(vertexes) / 3),
                                   pyglet.gl.GL_TRIANGLES,
                                   None,
                                   indexes,
                                   ("v3f", vertexes),
                                   ("c3f", colors))
            if tile11.lowest_neighbour:
                if tile00 == tile11.lowest_neighbour:
                    draw_river(tile00, mid00, tile11)
                elif tile01 == tile11.lowest_neighbour:
                    draw_river(tile01, mid01, tile11)
                elif tile02 == tile11.lowest_neighbour:
                    draw_river(tile02, mid02, tile11)
                elif tile10 == tile11.lowest_neighbour:
                    draw_river(tile10, mid10, tile11)
                elif tile12 == tile11.lowest_neighbour:
                    draw_river(tile12, mid12, tile11)
                elif tile20 == tile11.lowest_neighbour:
                    draw_river(tile20, mid20, tile11)
                elif tile21 == tile11.lowest_neighbour:
                    draw_river(tile21, mid21, tile11)
                elif tile22 == tile11.lowest_neighbour:
                    draw_river(tile22, mid22, tile11)

        # Land surface.
        for x in range(1, TILE_COUNT - 1):
            for y in range(1, TILE_COUNT - 1):
                draw_tile(self.get_tile(x, y))

        # Sea surface.
        sea = True
        if sea:
            step_size = 8
            for x in range(-TILE_COUNT, 2 * TILE_COUNT, step_size):
                vertex_strip: List[float] = []
                color_strip: List[float] = []
                for y in range(-TILE_COUNT, 2 * TILE_COUNT, step_size):
                    if not vertex_strip:
                        vertex_strip += [x * TILE_SIZE, y * TILE_SIZE, self.enviroment.sealevel]
                        color_strip += BLUE
                    vertex_strip += [x * TILE_SIZE, y * TILE_SIZE, self.enviroment.sealevel]
                    color_strip += BLUE
                    vertex_strip += [(x + step_size) * TILE_SIZE,
                                     (y + step_size) * TILE_SIZE,
                                     self.enviroment.sealevel]
                    color_strip += BLUE
                vertex_strip += [(x + step_size) * TILE_SIZE,
                                 (y + step_size) * TILE_SIZE,
                                 self.enviroment.sealevel]
                color_strip += BLUE

                self.batch.add(
                    int(len(vertex_strip) / 3),
                    pyglet.gl.GL_QUAD_STRIP,
                    None,
                    ("v3f", vertex_strip),
                    ("c3f", color_strip),
                    )


class HelloWorldWindow(pyglet.window.Window):
    """ Draw a pretty 3D map with basic UI of the flowing-terrain algorithm. """
    def __init__(self) -> None:
        super(HelloWorldWindow, self).__init__(width=WINDOW_SIZE,
                                               height=WINDOW_SIZE,
                                               resizable=True)
        self.label = pyglet.text.Label('Hello, world!', x=10, y=10)

        self.geography = Geography()

        self.camera_pos = {"x": WINDOW_SIZE / 2,
                           "y": WINDOW_SIZE / 2,
                           "z": WINDOW_SIZE / 4}
        self.camera_heading: float = 0
        self.angle: float = 0
        self.keys: Dict[int, List[int]] = {}
        self.keys_debounce: Dict[int, int] = {}
        self.wireframe: bool = False

        pyglet.clock.schedule_interval(self.update, 1/60.0)

        pyglet.graphics.glEnable(pyglet.graphics.GL_DEPTH_TEST)
        pyglet.graphics.glEnable(pyglet.gl.GL_BLEND)
        pyglet.graphics.glBlendFunc(pyglet.gl.GL_SRC_ALPHA, pyglet.gl.GL_ONE_MINUS_SRC_ALPHA)

        pyglet.gl.glLineWidth(2)

        glClearColor(0.5, 0.69, 1.0, 1)
        self.setup_fog()

    @classmethod
    def setup_fog(cls) -> None:
        """ Configure the OpenGL fog properties. """
        # Enable fog. Fog "blends a fog color with each rasterized pixel fragment's
        # post-texturing color."
        glEnable(GL_FOG)
        # Set the fog color.
        glFogfv(GL_FOG_COLOR, (GLfloat * 4)(0.5, 0.69, 1.0, 1))
        # Say we have no preference between rendering speed and quality.
        glHint(GL_FOG_HINT, GL_DONT_CARE)
        # Specify the equation used to compute the blending factor.
        glFogi(GL_FOG_MODE, GL_LINEAR)
        # How close and far away fog starts and ends. The closer the start and end,
        # the denser the fog in the fog range.
        glFogf(GL_FOG_START, 20.0)
        glFogf(GL_FOG_END, WINDOW_SIZE / 2)

    def on_draw(self) -> None:
        """ Pyglet callback to draw 3D scene. """
        self.clear()

        glMatrixMode(GL_PROJECTION)
        glLoadIdentity()
        glMatrixMode(GL_MODELVIEW)
        glLoadIdentity()

        gluPerspective(120, window.width / window.height, 1, 2000)
        glRotatef(-self.angle, 1, 0, 0)
        glRotatef(self.camera_heading, 0, 0, 1)
        glTranslatef(-self.camera_pos["x"],
                     -self.camera_pos["y"],
                     -self.camera_pos["z"])

        self.geography.batch.draw()
        self.label.draw()

    def on_key_press(self, symbol: int, modifiers: List[int]) -> None:
        """ Pyglet callback on key press. """
        self.keys[symbol] = modifiers

    def on_key_release(self, symbol: int, modifiers: List[int]) -> None:
        """ Pyglet callback on key release. """
        del self.keys[symbol]

    def on_mouse_drag(self,
                      x: int,
                      y: int,
                      dx: int,
                      dy: int,
                      buttons: List[int],
                      modifiers: List[int]) -> None:
        """ Pyglet callback on mouse drag. """
        self.camera_heading += dx / 4
        self.angle += dy / 4
        self.angle = max(self.angle, 0)

    def update(self, dt: int) -> None:
        """ Called periodically to handle UI.
        Scheduled by pyglet.clock.schedule_interval(...)
        """
        keys_debounce_to_clear = []
        for key_debounce in self.keys_debounce:
            self.keys_debounce[key_debounce] -= 1
            if self.keys_debounce[key_debounce] < 1:
                keys_debounce_to_clear.append(key_debounce)
        for key_debounce in keys_debounce_to_clear:
            del self.keys_debounce[key_debounce]

        if key.UP in self.keys and self.keys[key.UP]:
            # UP key with any modifier.
            # Raise height.
            self.camera_pos["z"] -= dt * 30
            self.camera_pos["z"] = max(self.camera_pos["z"],
                                       self.geography.enviroment.sealevel)
        if key.DOWN in self.keys and self.keys[key.DOWN]:
            # DOWN key with any modifier.
            # Lower height.
            self.camera_pos["z"] += dt * 30

        if key.UP in self.keys and not self.keys[key.UP]:
            # Unmodified UP key.
            # Move forward.
            heading = math.radians(self.camera_heading)
            self.camera_pos["x"] += math.sin(heading) * dt * 30
            self.camera_pos["y"] += math.cos(heading) * dt * 30
        if key.DOWN in self.keys and not self.keys[key.DOWN]:
            # Unmodified DOWN key.
            # Move backwards.
            heading = math.radians(self.camera_heading)
            self.camera_pos["x"] -= math.sin(heading) * dt * 30
            self.camera_pos["y"] -= math.cos(heading) * dt * 30
        if key.LEFT in self.keys and not self.keys[key.LEFT]:
            # Unmodified LEFT key.
            # Pan left.
            heading = math.radians(self.camera_heading + 90)
            self.camera_pos["x"] -= math.sin(heading) * dt * 30
            self.camera_pos["y"] -= math.cos(heading) * dt * 30
        if key.RIGHT in self.keys and not self.keys[key.RIGHT]:
            # Unmodified RIGHT key.
            # Pan right.
            heading = math.radians(self.camera_heading + 90)
            self.camera_pos["x"] += math.sin(heading) * dt * 30
            self.camera_pos["y"] += math.cos(heading) * dt * 30

        if key.SPACE in self.keys:
            # Switch between wireframe and normal view.
            if key.SPACE not in self.keys_debounce:
                self.keys_debounce[key.SPACE] = 10
                if self.wireframe:
                    glPolygonMode(GL_FRONT_AND_BACK, GL_FILL)
                    self.wireframe = False
                else:
                    glPolygonMode(GL_FRONT_AND_BACK, GL_LINE)
                    self.wireframe = True


if __name__ == '__main__':
    window = HelloWorldWindow()
    print("OpenGL Context: {}".format(window.context.get_info().version))
    print()
    print("Mouse click and drag to look around.")
    print("Cursor keys to move around.")
    print("Cursor keys with [SHIFT] to change height.")
    pyglet.app.run()
