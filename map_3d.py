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

import pyglet
from pyglet.gl import *
from pyglet.window import key
from typing import Tuple, List, Any
from sortedcontainers import SortedSet  # pip3 install sortedcontainers
import random

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
    sealevel: int = 0
    dampest: int = 0


class Tile:
    pos: Tuple[int, int] = (-1, -1)
    height: int = -1
    dampness: int = 1
    sealevel: int = 0
    highest_point: int = 0
    dampest: int = 100
    enviroment: Enviroment = None

    def __init__(self, pos: Tuple[int, int], enviroment: Enviroment):
        self.x = pos[0]
        self.y = pos[1]
        self.pos = pos
        self.enviroment = enviroment

    def __lt__(self, other):
        return id(self) < id(other)

    def get_colour(self) -> Tuple[int, int, int]:
        if self.height is None:
            return RED
        elif self.height < self.enviroment.sealevel:
            return (0.5 * float(self.height) / self.enviroment.highest_point,
                    0.5 * float(self.height) / self.enviroment.highest_point,
                    1.0 - float(self.height) / self.enviroment.highest_point)
        else:
            return (1.0 - float(self.height) / self.enviroment.highest_point,
                    1.0 - 0.8 * float(self.height) / self.enviroment.highest_point,
                    1.0 - float(self.height) / self.enviroment.highest_point)


class Geography:
    tiles: List[List[Tile]] = []
    open_set_sorted = SortedSet()
    enviroment = Enviroment()

    def __init__(self):
        for _ in range(TILE_COUNT):
            self.tiles.append([None] * TILE_COUNT)
        self._starting_points()
        self.heights_algorithm()
        self.drainage_algorithm()

    def get_tile(self, x: int, y: int):
        tile = self.tiles[x][y]
        if tile is None:
            tile = Tile((x, y), self.enviroment)
            self.tiles[x][y] = tile
        return tile

    def heights_algorithm(self):
        while self.open_set_sorted:
            height, tile = self.open_set_sorted.pop(0)
            for neighbour in self.get_neighbours_filtered(tile):
                new_height = height + random.randint(1, JITTER)
                neighbour.height = new_height
                self.open_set_sorted.add((new_height, neighbour))

                if new_height > self.enviroment.highest_point:
                    self.enviroment.highest_point = new_height
        self.enviroment.sealevel = self.enviroment.highest_point / random.uniform(1.5, 4)

    def drainage_algorithm(self):
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
            assert(lowest_neighbour)
            lowest_neighbour.dampness += tile.dampness

            if tile.dampness > self.enviroment.dampest:
                self.enviroment.dampest = tile.dampness

    def get_neighbours(self, tile: Tile) -> List[Tile]:
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

    def get_neighbours_filtered(self, tile: Tile) -> List[Tile]:
        for neighbour in self.get_neighbours(tile):
            if neighbour.height < 0:
                yield neighbour

    def _starting_points(self):
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

    def draw_mesh(self):
        print("get_mesh")

        def append_tile(vertex_strip, color_strip, tile):
            vertex_strip.append(tile.x * TILE_SIZE)
            vertex_strip.append(tile.y * TILE_SIZE)
            vertex_strip.append(tile.height)
            color_strip += tile.get_colour()

        xyz_array = []
        for x in range(TILE_COUNT - 1):
            vertex_strip = []
            color_strip = []
            tile_low = None
            tile_high = None
            for y in range(TILE_COUNT):
                #print(x, y)
                tile_low = self.get_tile(x, y)
                tile_high = self.get_tile(x + 1, y)

                if not vertex_strip:
                    append_tile(vertex_strip, color_strip, tile_low)
                append_tile(vertex_strip, color_strip, tile_low)
                append_tile(vertex_strip, color_strip, tile_high)
            append_tile(vertex_strip, color_strip, tile_high)
            pyglet.graphics.draw(int(len(vertex_strip) / 3),
                    pyglet.gl.GL_QUAD_STRIP,
                    ("v3f", vertex_strip),
                    ("c3f", color_strip),
                    )


class HelloWorldWindow(pyglet.window.Window):
    def __init__(self):
        super(HelloWorldWindow, self).__init__(width=WINDOW_SIZE,
                                               height=WINDOW_SIZE,
                                               resizable=True)
        self.label = pyglet.text.Label('Hello, world!', x=10, y=10)

        self.geography = Geography()

        self.camera_height = (WINDOW_SIZE / 2)
        self.camera_heading = 0
        self.angle = 0

    def on_draw(self):
        self.clear()

        glMatrixMode(GL_PROJECTION)
        glLoadIdentity()
        gluPerspective(120, window.width / window.height, 0.01, 10000)
        glTranslatef(-WINDOW_SIZE / 2, -WINDOW_SIZE / 2, -self.camera_height)
        glRotatef(self.angle, 1, 0, 0)
        glRotatef(self.camera_heading, 0, 1, 0)

        glMatrixMode(GL_MODELVIEW) 
        glLoadIdentity()

        self.geography.draw_mesh()
        self.label.draw()

    def on_key_press(self, symbol, modifiers):
        if symbol == key.UP:
            self.camera_height -= 10
        if symbol == key.DOWN:
            self.camera_height += 10

    def on_mouse_drag(self, x, y, dx, dy, buttons, modifiers):
        #self.camera_heading += dx / 4
        self.angle -= dy / 4

if __name__ == '__main__':
    window = HelloWorldWindow()
    print("OpenGL Context: {}".format(window.context.get_info().version))
    pyglet.app.run()
