import React from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Link from '@mui/material/Link';

const ResultsTable = ({ results, onResetSearch }) => {
    const handleTableNameClick = (tableName) => {
        console.log('Table Name Clicked:', tableName);
        // Add your logic for handling the click event here
        // For example, you could navigate to a details page or open a modal
    };

    return (
        <div>
            <Table size="small" aria-label="a dense table">
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ color: '#ABADC6', fontWeight: 'bold' }}>Index</TableCell>
                        <TableCell sx={{ color: '#ABADC6', fontWeight: 'bold' }}>Table Name</TableCell>
                        <TableCell sx={{ color: '#ABADC6', fontWeight: 'bold' }}>Description</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {results.map((row, index) => (
                        <TableRow key={index}>
                            <TableCell component="th" scope="row" sx={{ color: '#ABADC6' }}>
                                {index + 1}
                            </TableCell>
                            <TableCell sx={{ color: '#ABADC6', textAlign: 'left'}}>
                                <Link
                                    component="button"
                                    variant="body2"
                                    onClick={() => handleTableNameClick(row.table_name)}
                                    sx={{ color: '#ABADC6', textDecoration: 'none', cursor: 'pointer', textAlign: 'left',  
                                    '&:hover': {
                                        color: '#white',
                                        // fontWeight: 'bold'
                                    }}}
                                >
                                    {row.table_name}
                                </Link>
                            </TableCell>
                            <TableCell sx={{ color: '#ABADC6', textAlign: 'left' }}>{row.table_name}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <Button
                variant="outlined"
                size="small"
                startIcon={<RestartAltIcon />}
                onClick={onResetSearch}
                sx={{
                    margin: '15px 0px',
                    fontSize: '0.8rem',
                }}
            >
                Reset Search Space from Here
            </Button>
        </div>
    );
};
export default ResultsTable;

// export default ResultsTable;
// import React, { useState } from 'react';
// import Table from '@mui/material/Table';
// import TableBody from '@mui/material/TableBody';
// import TableCell from '@mui/material/TableCell';
// import TableHead from '@mui/material/TableHead';
// import TableRow from '@mui/material/TableRow';
// import Button from '@mui/material/Button';
// import RestartAltIcon from '@mui/icons-material/RestartAlt';
// import Link from '@mui/material/Link';
// import Collapse from '@mui/material/Collapse';
// import Box from '@mui/material/Box';
// import data from '../mock_data/updated_data_gov_mock_data.json'
// import IconButton from '@mui/material/IconButton';
// import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
// import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

// const ResultsTable = ({ results, onResetSearch }) => {
//     const [openRows, setOpenRows] = useState({});
//     const handleRowClick = (index) => {
//         setOpenRows((prevOpenRows) => ({
//             ...prevOpenRows,
//             [index]: !prevOpenRows[index],
//         }));
//     };
//     console.log("U.S. Hourly Precipitation Data".toLowerCase())
//     console.log(data.filter(item => item["Table name"].toLowerCase() === "u.s. hourly precipitation data" ))
//     return (
//         <div>
//             <Table size="small" aria-label="a dense table">
//                 <TableHead>
//                     <TableRow>
//                         <TableCell sx={{ color: '#ABADC6', fontWeight: 'bold'}}>Index</TableCell>
//                         <TableCell sx={{ color: '#ABADC6', fontWeight: 'bold' }}>Table Name</TableCell>
//                         <TableCell sx={{ color: '#ABADC6', fontWeight: 'bold' }}># Columns</TableCell>
//                         <TableCell sx={{ color: '#ABADC6', fontWeight: 'bold' }}>Time Granularity</TableCell>
//                         <TableCell sx={{ color: '#ABADC6', fontWeight: 'bold' }}>Popularity</TableCell>
//                     </TableRow>
//                 </TableHead>
//                 <TableBody>
//                     {results.map((row, index) => (
//                         <React.Fragment key={index}>
//                             <TableRow>
//                                 <TableCell component="th" scope="row" sx={{ color: '#ABADC6', textAlign: 'left', borderBottom:'none'}}>
//                                     {index + 1}
//                                 </TableCell>
//                                 <TableCell sx={{ color: '#ABADC6', textAlign: 'left', borderBottom:'none', width: '40%'}}>
//                                     <Link
//                                         component="button"
//                                         variant="body2"
//                                         onClick={() => handleRowClick(index)}
//                                         sx={{
//                                             color: '#ABADC6',
//                                             cursor: 'pointer',
//                                             textDecoration: 'none',
//                                             textAlign : 'left',                                    
//                                             '&:hover': {
//                                                 color: 'white',
//                                                 fontSize: '0.87',
//                                                 fontWeight: 700
//                                             },
//                                         }}
//                                     >
//                                         {row.table_name}
//                                     </Link>
//                                 </TableCell>
//                                 <TableCell sx = {{ width: "400px", color: '#ABADC6', textAlign: 'left', borderBottom: 'none', overflow: "auto", whiteSpace: "no-wrap"}}> {row.col_num} </TableCell>
//                                 <TableCell sx = {{ width: "400px", color: '#ABADC6', textAlign: 'left', borderBottom: 'none', overflow: "auto", whiteSpace: "no-wrap"}}> {row.time_granu} </TableCell>
//                                 <TableCell sx = {{ width: "400px", color: '#ABADC6', textAlign: 'left', borderBottom: 'none', overflow: "auto", whiteSpace: "no-wrap"}}> {row.popularity} </TableCell>
//                                 {/* <TableCell sx={{ width: "400px", color: '#ABADC6', textAlign: 'left', borderBottom: 'none', overflow: "auto", whiteSpace: "no-wrap"}}>
//                                     {
//                                         data.filter(item => item["Table name"].toLowerCase() === row.table_name)[0]["Table description"]
//                                     }
//                                 </TableCell> */}
//                             </TableRow>
//                             <TableRow>
//                                 <TableCell style={{ paddingBottom: 0, paddingTop: 0, paddingLeft: '76px', borderTop: 'none'}} colSpan={6}>
//                                     <Collapse in={openRows[index]} timeout="auto" unmountOnExit>
//                                         <Box margin={1} sx={{ border: 'none' }}>
//                                             <div style={{ color: '#ABADC6', fontSize: '0.875rem' }}>
//                                                 <div>{data.filter(item => item["Table name"].toLowerCase() === row.table_name)[0]["Table description"]}</div>
//                                                 {/* <div>{data.filter(item => item["Table name"].toLowerCase() === row.table_name)[0]["Table schema"]}</div> */}
//                                                 {/* <div>Geography Granularity: {row.geo_granu}</div> */}
//                                                 {/* <div>Number of Cols: {row.col_num}</div>
//                                                 <div>Popularity: {row.popularity}</div> */}
//                                             </div>
//                                         </Box>
//                                     </Collapse>
//                                 </TableCell>
//                             </TableRow>
//                         </React.Fragment>
//                     ))}
//                 </TableBody>
//             </Table>

//             <Button
//                 variant="outlined"
//                 size="small"
//                 startIcon={<RestartAltIcon />}
//                 onClick={onResetSearch}
//                 sx={{
//                     margin: '15px 0px',
//                     fontSize: '0.8rem',
//                 }}
//             >
//                 Reset Search Space from Here
//             </Button>
//         </div>
//     );
// };
