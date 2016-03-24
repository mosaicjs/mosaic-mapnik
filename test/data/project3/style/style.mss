Map {
  buffer-size: 256;
}

#basemap {
  ::geom {
      polygon-fill: #f2eff9;
      polygon-opacity: 1;
      
      line-width: 0.1;
      line-color: #426;
  }
  
  ::labels {
      text-name: [NAME];
      text-face-name: 'Droid Sans Regular';
      text-fill: black;
      text-size: 12;    
   }  
}
