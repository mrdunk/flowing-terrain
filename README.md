# flowing-terrain
This project is intended to document a simple algorithm for creating 3
dimensional terrain maps and their likely watercourses.
![islands](https://github.com/mrdunk/flowing-terrain/blob/master/assets/islands.png)

## The problem:
My previous experiments in creating maps for computer software models using
fractal or perlin noise techniques can create some realistic looking terrain but
always led to unrealistic depressions in the terrain (basins) which rivers
cannot flow out of.

Amit's great online tutorial here:
https://www.redblobgames.com/maps/terrain-from-noise/
shows examples with many of these depressions filled as lakes.

Treating these depressions as lakes and "flooding" them can work but is quite
computationally expensive: For every pixel in the map you must "flood" outwards
and see if you reach your desired sealevel before being hemmed in by higher
points. Also, many little lakes might not be the style of terrain you are
looking for.
An alternative i also played with is raising the height whenever one of these
"lakes" is detected. It can work but a bit messy to code and still
computationally expensive.

## The solution:
Recently i had a mental breakthrough which i haven't seen online before.
It seems too obvious to be novel so please contact me (open a Github issue) if
you've seen it used before.

This project describes a simple algorithm to generate terrain for which any
selected point on the map which is above "height == 0" will always have at
least one adjacent point lower than it.
This algorithm has O(n log(n)) time complexity.

A 2nd algorithm then calculates a "drainage index" for each point which is a
simple count of how many tiles have a parent of this tile as their lowest
neighbour. Larger drainage indexes indicate more upstream tiles have drained
into this one.

## The code:
The example code written in Python3.
It is not heavily optimized; I wrote and tested it in 2 evenings.
It requires the following libraries to be installed:
https://pyglet.readthedocs.io/en/latest/index.html
http://www.grantjenks.com/docs/sortedcontainers/sortedset.html

On my Ubuntu system the following installs these:
```
# pip3 install sortedcontainers --user
# pip3 install pyglet --user
```

Disclaimer: I promised you "no lakes/basins/lowbits/etc" but in the code i
deliberately lower a random number of points to create more interesting land.

## The heights algorithm:
The main algorithm is run first and generates the height map of the terrain. The
example code then allocates a "sealevel" and things like that but this is just
extra sugar.
Think of this main algorithm like a "flood fill" except it always proceeds from
the next lowest point.

In this demonstration we set the outermost tile height to 0 (white) and put them
in a sorted set called "open_set", sorted by height. These are the seed tiles
where the algorithm starts.

![diagram1](https://github.com/mrdunk/flowing-terrain/blob/master/assets/diagram1.png)
The algorithm picks the seed tile with the lowest height value from the open_set
(using the tile's python object id() as a tie breaker) and assigns heights to
any of it's neighbours not yet dealt with and assign to open_set.
(Picked tile highlighted in red diagram1.)

![diagram2](https://github.com/mrdunk/flowing-terrain/blob/master/assets/diagram2.png)
Next we pick the tile from the open_set with the next lowest height value, which
here is another of the while edge tiles, and do the same again.
Continue doing this until all the seed tiles are processed.

![diagram3](https://github.com/mrdunk/flowing-terrain/blob/master/assets/diagram3.png)
![diagram4](https://github.com/mrdunk/flowing-terrain/blob/master/assets/diagram4.png)
Continue with the tile with the next lowest height value in the open_set
(highlighted in red).

![diagram5](https://github.com/mrdunk/flowing-terrain/blob/master/assets/diagram5.png)
Eventually all tiles will be processed and have heights set.

## The drainage algorithm:
1. Put all tiles in an ordered set, ordered by height.
1. Iterate through the ordered set from highest above sea level to lowest, adding 1 to the drainage value of the tiles lowest neighbour.

At the end of this process every tile will have a drainage value equivalent to
the number of tiles draining into it. Rivers can be assumed to exist in tiles
with a higher value.
