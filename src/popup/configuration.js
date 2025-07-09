function determineConfiguration(headers) {
  const config = {
    coordinateSystem: "2d",
    landmarkPoints: "3",
    filterType: "exponential"
  };

  // Improved 3D coordinate detection
  const has3DCoordinates = headers.some(header => 
    header.includes("_z") || 
    header.includes("landmark3_2_z") || 
    header.includes("landmark6_2_z")
  );
  
  if (has3DCoordinates) {
    config.coordinateSystem = "3d";
    console.log("Detected 3D coordinates in calibration data");
  }

  // Determine number of landmarks
  const landmarkCount = Math.max(
    headers.filter(h => h.match(/landmark3_\d+_x/)).length,
    headers.filter(h => h.match(/landmark6_\d+_x/)).length
  );

  if (landmarkCount > 3) {
    config.landmarkPoints = "6";
  }

  console.log("Determined configuration:", config);
  return config;
}

function updateConfigurationUI(config) {
  try {
      // Check if elements exist before trying to update them
      const coordRadio = document.querySelector(
          `input[name="coordinates"][value="${config.coordinateSystem}"]`
      );
      if (coordRadio) {
          coordRadio.checked = true;
      } else {
          console.warn(`Coordinate system radio button for ${config.coordinateSystem} not found`);
      }

      // Store configuration in state
      state.config = {
          ...config,
          animationStyle: "without-line", // Default to no animation for uploaded calibration
          filterType: config.filterType || "exponential" // Default to exponential if not specified
      };

      console.log("Updated configuration:", state.config);
  } catch (error) {
      console.error("Error updating configuration UI:", error);
      throw new Error("Failed to update configuration UI");
  }
}