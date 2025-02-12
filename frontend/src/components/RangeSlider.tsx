import React, { useState, useEffect } from "react";
import { Grid, TextField, InputAdornment } from "@material-ui/core";
import { InputLabel, FormControl } from "@mui/material";
import { Slider, Rail, Handles, Tracks, Ticks } from "react-compound-slider";
import { MuiRail, MuiHandle, MuiTrack, MuiTick } from "./Slider";
import BarChart from "./BarChart";

export interface RangeSliderProps {
  data: number[]; // data should be an array of numbers
  minValue: number;
  setMinValue: React.Dispatch<React.SetStateAction<number>>;
  maxValue: number;
  setMaxValue: React.Dispatch<React.SetStateAction<number>>;
}

const RangeSlider = ({
  data,
  minValue,
  setMinValue,
  maxValue,
  setMaxValue,
}: RangeSliderProps) => {
  // State for the slider and input fields
  const [domain, setDomain] = useState<[number, number]>([0, 0]); // min and max range
  const [updates, setUpdates] = useState<[number, number]>([
    minValue,
    maxValue,
  ]);
  const [values, setValues] = useState<[number, number]>([minValue, maxValue]); // finalized range when slider changes

  // Initialize domain and values based on data
  useEffect(() => {
    if (data && data.length > 0) {
      const minValue = Math.min(...data);
      const maxValue = Math.max(...data);
      const range: [number, number] = [minValue, maxValue];
      setDomain(range);
      setUpdates(range);
      setValues(range);
      setMinValue(minValue);
      setMaxValue(maxValue);
    }
  }, [data]);

  useEffect(() => {
    setValues(values);
    setMinValue(values[0]);
    setMaxValue(values[1]);
  }, [values]);

  // Handle slider update drag
  const handleSliderUpdate = (newValues: readonly number[]) => {
    setUpdates([newValues[0], newValues[1]]);
  };

  // Handle slider release
  const handleSliderChange = (newValues: readonly number[]) => {
    console.log("Slider Released: ", newValues);
    setValues([newValues[0], newValues[1]]);
    setUpdates([newValues[0], newValues[1]]);
    setMinValue(newValues[0]);
    setMaxValue(newValues[1]);
  };

  // Handle input field changes
  // Handle input field changes
  const handleInputChange =
    (index: number) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        event.target.value === "" ? "" : parseFloat(event.target.value);
      console.log("Input Value:", value);

      // Create a copy of the current values
      const newValues: [number | "", number | ""] = [...values];
      newValues[index] = value;

      console.log("New Values:", newValues);

      // Update slider values if input is valid
      if (
        typeof value === "number" &&
        value >= domain[0] &&
        value <= domain[1]
      ) {
        // Ensure the other value is a number (not an empty string)
        const otherValue = newValues[1 - index]; // Get the other value (min or max)
        const validatedOtherValue =
          typeof otherValue === "number" ? otherValue : values[1 - index];

        // Create the updated values array
        const updatedValues: [number, number] = [
          index === 0 ? value : validatedOtherValue,
          index === 1 ? value : validatedOtherValue,
        ];

        // Update the state
        setValues(updatedValues);
        setMinValue(updatedValues[0]);
        setMaxValue(updatedValues[1]);
      }
    };

  return (
    <Grid container>
      <Grid item xs={12}>
        <div
          style={{ background: "white", padding: "16px", borderRadius: "8px" }}
        >
          {/* Bar Chart */}
          <BarChart data={data} values={values} domain={domain} numBins={10} />

          {/* Slider */}
          <Slider
            mode={2} // slider handles cannot move past each other
            step={1}
            domain={domain}
            rootStyle={{ position: "relative", width: "100%" }}
            onUpdate={handleSliderUpdate} // Called while dragging
            onChange={handleSliderChange} // Called when dragging ends
            values={values} // Current position of slider handles
          >
            <Rail>
              {({ getRailProps }) => <MuiRail getRailProps={getRailProps} />}
            </Rail>
            <Handles>
              {({ handles, getHandleProps }) => (
                <div className="slider-handles">
                  {handles.map((handle) => (
                    <MuiHandle
                      key={handle.id}
                      handle={handle}
                      domain={domain}
                      getHandleProps={getHandleProps}
                    />
                  ))}
                </div>
              )}
            </Handles>
            <Tracks left={false} right={false}>
              {({ tracks, getTrackProps }) => (
                <div className="slider-tracks">
                  {tracks.map(({ id, source, target }) => (
                    <MuiTrack
                      key={id}
                      source={source}
                      target={target}
                      getTrackProps={getTrackProps}
                    />
                  ))}
                </div>
              )}
            </Tracks>
            <Ticks count={5}>
              {({ ticks }) => (
                <div className="slider-ticks">
                  {ticks.map((tick) => (
                    <MuiTick
                      key={tick.id}
                      tick={tick}
                      count={ticks.length}
                      format={(value) => value.toString()}
                    />
                  ))}
                </div>
              )}
            </Ticks>
          </Slider>

          {/* Input Fields */}
          <Grid
            container
            alignItems="center"
            justifyContent="space-between"
            style={{ marginTop: "70px" }}
          >
            <Grid item xs={3} style={{ textAlign: "right" }}>
              <FormControl fullWidth variant="outlined">
                <InputLabel
                  sx={{
                    backgroundColor: "white",
                    padding: "0 4px",
                    transform: "translate(14px, -10px) scale(0.75)",
                    fontWeight: "600",
                  }}
                >
                  minimum
                </InputLabel>
                <TextField
                  variant="outlined"
                  value={values[0]}
                  onChange={handleInputChange(0)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start"></InputAdornment>
                    ),
                  }}
                />
              </FormControl>
            </Grid>

            <Grid item xs={3} style={{ textAlign: "center" }}>
              —
            </Grid>

            <Grid item xs={3} style={{ textAlign: "left" }}>
              <FormControl fullWidth variant="outlined">
                <InputLabel
                  sx={{
                    backgroundColor: "white",
                    padding: "0 4px",
                    transform: "translate(14px, -10px) scale(0.75)",
                    fontWeight: "600",
                  }}
                >
                  maximum
                </InputLabel>
                <TextField
                  variant="outlined"
                  value={values[1]}
                  onChange={handleInputChange(1)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start"></InputAdornment>
                    ),
                  }}
                />
              </FormControl>
            </Grid>
          </Grid>
        </div>
      </Grid>
    </Grid>
  );
};

export default RangeSlider;
