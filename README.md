# TLDR
Web version:  
https://mrdunk.github.io/flowing-terrain/implementations/ts/dist/flowing_terrain.html  
Mouse and cursor keys to move around.

# flowing-terrain
This project is intended to document a simple algorithm for creating 3
dimensional terrain maps and their likely watercourses.

In the screenshots darker tiles indicate higher elevation.
Red highlights show the drainage value; Areas with more red are where rivers will form.
![islands](https://github.com/mrdunk/flowing-terrain/blob/master/assets/watershed.png)
![web_demo_with_trees](https://github.com/mrdunk/flowing-terrain/blob/master/assets/web_demo_with_trees.png)

## The problem:
My previous experiments in creating maps for computer software models using
fractal or perlin noise techniques can create some realistic looking terrain but
always led to unrealistic depressions in the terrain (basins) which rivers
cannot flow out of.

Amit's great online tutorial here:
https://www.redblobgames.com/maps/terrain-from-noise/
shows examples with many of these depressions filled as lakes.

Treating these depressions as lakes and "flooding" them can work but is quite
computationally expensive: For every pixel in the map you must do a trial "flood"
outwards and see if you reach your desired sealevel before being hemmed in by
higher points. Also, many little lakes might not be the style of terrain you are
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
This algorithm theoretically has O(n log(n)) time complexity providing a
suitable Sorted Set data structure capable of log(n) add and pop operations is
used.  
In practice the algorithm described here actually /more/ efficient than that as
the Sorted Set never approaches n members. (Typically it will contain
approximately (4 * sqrt(m)) where m is the number of nodes left to be
processed.) As a result it may not be necessary to source an efficient Sorted
Set library if one is not available for your platform.

A 2nd algorithm then calculates a "drainage index" for each point which is a
simple count of how many tiles have a parent of this tile as their lowest
neighbour. Larger drainage indexes indicate more upstream tiles have drained
into this one.

## The code:
If you just want to understand how the algorithm works, i recommend looking at
the `./implementations/python/map.py` code.  
If you want to see some of the issues you'll run into if you implement this in
3d, Look at the Typescript example. TLDR: Care is required when tiling the mesh
so faces don't obscure low points where rivers may flow.

### Python
`./implementations/python/map.py`  
This example code written in Python3 and was my first proof of concept after
realising this approach would work.  
It is not heavily optimized; I wrote and tested it in 2 evenings.  
It requires the following libraries to be installed:  
https://pyglet.readthedocs.io/en/latest/index.html  
http://www.grantjenks.com/docs/sortedcontainers/sortedset.html  

On my Ubuntu system the following installs these:
```
# pip3 install sortedcontainers --user
# pip3 install pyglet --user
```

Disclaimer: I promised you "no lakes/basins/lowbits/etc" but in this example i
deliberately lower a random number of points on the map to create more
interesting land. This will result in some large, sea-level lakes.

### Typescript
`./implementations/ts/`  
I also created a nice [Typescript](https://www.typescriptlang.org/) Web version
so people can play without installing. I like Typescript. It's like Javascript
without the crazy.  
It uses the excellent https://www.babylonjs.com/ for the shiny 3D web view.  
There's a compiled version here:  
https://mrdunk.github.io/flowing-terrain/implementations/ts/dist/flowing_terrain.html  
Mouse and cursor keys to move around.  

I'll presume anyone wanting to build this for themselves can make use of the
`npm` and `gulp` config files in that directory.  
Otherwise raise a bug and i'll try my best but i'm not particularly proficient with
Typescript and Web technology in general.

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

Heights are assigned to neighbours by taking the height of the original tile and
adding some random value.



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

## Making terrain look less uniform:
On it's own the algorithm described here tends to fall into the trap of may procedurally generated landscape algorithms: Although generally irregular in shape, high ground ends up being roughly equidistant from the shore. This leads to "cone" shaped islands. (Fine for a volcanic landscape maybe?)  
The solution (demonstrated in the TypeScript version of the source code) is to use perlin noise when picking a "random" value to add to the height in the Heights algorithm. This gives the best of both worlds: Pelin noise chooses where mountains are but landscape still always slopes downwards until it reaches the sea.  
To see this in action, play with the sliders in the Tools menu of the online demo: 
https://mrdunk.github.io/flowing-terrain/implementations/ts/dist/flowing_terrain.html  

## Limitations:
1. Since the heights algorithm requires seeding with the lowest points on the desired map and floods outwards from there, this method only lends it's self to generating whole maps. It is not possible to use this algorithm recursively.

## Future work:
1. Experiment with ways of generating recursive layers of detail so a low resolution map can be generated with the heights algorithm then more detail can be added to a particular section as required.

## Some more screenshots:
![lizard](https://github.com/mrdunk/flowing-terrain/blob/master/assets/lizard.png)
![lagoon](https://github.com/mrdunk/flowing-terrain/blob/master/assets/lagoon.png)
![web_demo_perspective](https://github.com/mrdunk/flowing-terrain/blob/master/assets/web_demo_perspective.png)
![web_demo_overhead](https://github.com/mrdunk/flowing-terrain/blob/master/assets/web_demo_overhead.png)
![web_demo_with_trees](https://github.com/mrdunk/flowing-terrain/blob/master/assets/web_demo_with_trees.png)
