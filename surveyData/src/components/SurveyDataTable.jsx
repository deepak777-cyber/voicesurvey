import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import '../styles/styles.css'
import config from "../config";

const SurveyDataTable = () => {
    const [responses, setResponses] = useState([]);

    useEffect(() => {
        axios.get(`${config.API_BASE_URL}/api/survey/responses`)
            .then((res) => setResponses(res.data))
            .catch((err) => console.error("Error fetching:", err));
    }, []);

    const downloadExcel = () => {
        // const worksheet = XLSX.utils.json_to_sheet(responses);
        const cleanedResponses = responses.map(({ __v, ...rest }) => rest);
        const worksheet = XLSX.utils.json_to_sheet(cleanedResponses);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "SurveyData");
        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        saveAs(new Blob([excelBuffer]), "SurveyData.xlsx");
    };

    if (!responses.length) return <p>No data available</p>;

    const columns = Array.from(
        new Set(responses.flatMap((row) => Object.keys(row)))
    );


    return (
        <div className="table-container">
            <h2 className="table-header">Survey Responses</h2>

            <button className="download-btn" onClick={downloadExcel}>
                Download as Excel
            </button>

            <div className="table-scroll">
                <table className="data-table">
                    <thead>
                        <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
                    </thead>
                    <tbody>
                        {responses.map((row, idx) => (
                            <tr key={idx}>
                                {columns.map((col) => (
                                    <td key={col}>{row[col]}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );



};

export default SurveyDataTable;
