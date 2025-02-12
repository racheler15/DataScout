import React, { Fragment } from "react";
import {
  createStyles,
  withStyles,
  Theme,
  WithStyles,
} from "@material-ui/core/styles";
import PropTypes from "prop-types";
import Typography from "@material-ui/core/Typography";

// *******************************************************
// RAIL COMPONENT
// *******************************************************

const trackHeight = 2;
const thumbHeight = 12;

// Styles
const muiRailStyle = (theme: Theme) =>
  createStyles({
    rail: {
      backgroundColor: theme.palette.grey[400],
      width: "100%",
      height: trackHeight,
      position: "absolute",
      pointerEvents: "none",
    },
    railHotspot: {
      width: "100%",
      height: thumbHeight * 2,
      top: thumbHeight * -1,
      position: "absolute",
      cursor: "pointer",
    },
  });
// Props
interface MuiRailProps extends WithStyles<typeof muiRailStyle> {
  getRailProps: () => any;
}

// Component
const MuiRailComponent: React.FC<MuiRailProps> = ({
  classes,
  getRailProps,
}) => (
  <Fragment>
    <div className={classes.railHotspot} {...getRailProps()} />
    <div className={classes.rail} />
  </Fragment>
);

export const MuiRail = withStyles(muiRailStyle)(MuiRailComponent);

// *******************************************************
// HANDLE COMPONENT
// *******************************************************

// Styles
const muiHandleStyle = (theme: Theme) =>
  createStyles({
    root: {
      backgroundColor: theme.palette.secondary.main,
      marginLeft: thumbHeight * -0.5,
      marginTop: thumbHeight * -0.5,
      width: thumbHeight,
      height: thumbHeight,
      border: 0,
      borderRadius: "50%",
      position: "absolute",
      zIndex: 2,
      cursor: "pointer",
    },
  });
// Props
interface MuiHandleProps extends WithStyles<typeof muiHandleStyle> {
  domain: [number, number];
  handle: {
    id: string;
    value: number;
    percent: number;
  };
  getHandleProps: (id: string) => any;
}

// Component
const MuiHandleComponent: React.FC<MuiHandleProps> = ({
  domain: [min, max],
  handle: { id, value, percent },
  classes,
  getHandleProps,
}) => (
  <div
    role="slider"
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value}
    className={classes.root}
    style={{ left: `${percent}%` }}
    {...getHandleProps(id)}
  />
);

export const MuiHandle = withStyles(muiHandleStyle)(MuiHandleComponent);

// *******************************************************
// TRACK COMPONENT
// *******************************************************

// Styles
const muiTrackStyle = (theme: Theme) =>
  createStyles({
    track: {
      backgroundColor: theme.palette.secondary.main,
      height: trackHeight,
      position: "absolute",
      zIndex: 1,
      pointerEvents: "none",
    },
    trackHotspot: {
      height: thumbHeight,
      top: thumbHeight * -0.5,
      position: "absolute",
      cursor: "pointer",
    },
  });

// Props
interface MuiTrackProps extends WithStyles<typeof muiTrackStyle> {
  source: {
    id: string;
    value: number;
    percent: number;
  };
  target: {
    id: string;
    value: number;
    percent: number;
  };
  getTrackProps: () => any;
}

// Component
const MuiTrackComponent: React.FC<MuiTrackProps> = ({
  classes,
  source,
  target,
  getTrackProps,
}) => {
  const left = `${source.percent}%`;
  const width = `${target.percent - source.percent}%`;

  return (
    <Fragment>
      <div className={classes.track} style={{ left, width }} />
      <div
        className={classes.trackHotspot}
        style={{ left, width }}
        {...getTrackProps()}
      />
    </Fragment>
  );
};

export const MuiTrack = withStyles(muiTrackStyle)(MuiTrackComponent);

// *******************************************************
// TICK COMPONENT
// *******************************************************

// Styles
const muiTickStyle = (theme: Theme) =>
  createStyles({
    tick: {
      position: "absolute",
      marginTop: 14,
      width: 1,
      height: 5,
      backgroundColor: theme.palette.grey[400],
    },
    label: {
      position: "absolute",
      marginTop: 22,
      textAlign: "center",
    },
  });

// Props
interface MuiTickProps extends WithStyles<typeof muiTickStyle> {
  tick: {
    id: string;
    value: number;
    percent: number;
  };
  count: number;
  format?: (value: number) => string | number; // Make `format` optional
}

const MuiTickComponent: React.FC<MuiTickProps> = ({
  classes,
  tick,
  count,
  format = (d) => d, // Default `format` function
}) => (
  <div>
    <div className={classes.tick} style={{ left: `${tick.percent}%` }} />
    <Typography
      className={classes.label}
      variant="caption"
      style={{
        marginLeft: `${-(100 / count) / 2}%`,
        width: `${100 / count}%`,
        left: `${tick.percent}%`,
      }}
    >
      {format(tick.value)}
    </Typography>
  </div>
);

export const MuiTick = withStyles(muiTickStyle)(MuiTickComponent);
