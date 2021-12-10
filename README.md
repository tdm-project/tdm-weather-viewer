TDM Sparse Coding Library
=========================

[Enrico Gobbetti](mailto:gobbetti@crs4.it) and
[Fabio Bettio](mailto:fabio@crs4.it)

Visual and Data-intensive Computing, CRS4. Italy.

Copyright Notice
----------------

This software is **Copyright (C) 2021 by CRS4, Cagliari, Italy**. It is distributed under the [CC BY-NC-ND 4.0 license](https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode). For use in commercial projects, kindly contact Enrico Gobbetti at CRS4. If you use this software in a publication, kindly cite the references mentioned below. For more information, visit the [CRS4 Visual Computing](http://www.crs4.it/vic/) web page and the [TDM project](http://www.tdm-project.it) web pages. 

Abstract
--------
![TDM Weather Viewer - Overview](img/tdm-weather-viewer.jpg)
The **tdm-weather-viewer** is a javascript web app for rendering georeferenced raster or vector weather data that are displayed on a Leafletjs map.
For georeferenced rasters the software extends the Leaflet Layer class to embed the GeoTIFF format.
The raster images include various types of 2D scalar maps such as: precipitation, cloud cover, temperature, etc...
The implemented vector data are 2D maps of wind direction and speed rendered by particle tracing.
The format of the REST API to access weather data are specified at http://data.tdm-project.it/.

The viewer allows the exploration of meteorological data placed in Leaflet layers. The user can select the layers to be displayed in the popup menu at the top right. 
An interactive lens "perforates" the layers, allowing the user to have a more precise detail on the geographical position of the data.

Using the code
--------------

Clone the app into a web server directory:
```
git clone https://github.com/tdm-project/tdm-weather-viewer.git
```
Verify the correct functioning of the app via a web browser

Additional documentation is availabile in Deliverable D6.2 on the [TDM project deliverables](http://www.tdm-project.it/en/results/public-deliverables/) web site.

Acknowledgments
---------------

This work was partially suppored by Sardinian Regional Authorities under
projects VIGECLAB and TDM (POR FESR 2014-2020 Action 1.2.2).

References
----------

- Fabio Bettio, Giovanni Busonera, Marco Cogoni, Roberto Deidda, Mauro Del Rio, Massimo Gaggero, Enrico Gobbetti, Simone Leo, Simone Manca, Marino Marrocu, Luca Massidda, Fabio Marton, Marco Enrico Piras, Luca Pireddu, Gabriella Pusceddu, Alessandro Seoni, and Gianluigi Zanetti. TDM: un sistema aperto per l'acquisizione di dati, l'analisi e la simulazione su scala metropolitana. In Proc. GARR 2019 - Selected Papers. Pages 44-49, 2019. DOI: https://doi.org/10.26314/GARR-Conf19-proceedings-09.

- Fabio Bettio, Moonisa Ahsan, Fabio Marton, and Enrico Gobbetti. A novel approach for exploring annotated data with interactive lenses. Computer Graphics Forum, 40(3): 387-398, 2021. DOI: https://doi.org/10.1111/cgf.14315. Proc. EUROVIS 2021.

