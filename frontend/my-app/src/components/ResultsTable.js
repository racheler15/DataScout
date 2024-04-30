import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';

const ResultsTable = ({ results }) => {
    return (
        <Table size="small" aria-label="a dense table">
            <TableHead>
                <TableRow>
                    <TableCell sx={{ color: '#ABADC6', fontWeight: 'bold' }}>Index</TableCell>
                    <TableCell sx={{ color: '#ABADC6', fontWeight: 'bold' }}>Table Name</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {results.map((row, index) => (
                    <TableRow key={index}>
                        <TableCell component="th" scope="row" sx={{ color: '#ABADC6' }}>
                            {index + 1}
                        </TableCell>
                        <TableCell sx={{ color: '#ABADC6' }}>{row.table_name}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export default ResultsTable;
