import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import '../styles/styles.css'
const BASE_URL = import.meta.env.VITE_BASE_URL;

const SurveyDataTable = () => {
    const [responses, setResponses] = useState([]);

    useEffect(() => {
        axios.get(`${BASE_URL}/api/survey/responses`)
            .then((res) => {
                const cleaned = res.data.map(({ _id, __v, updatedAt, ...rest }) => {
                    const { respid, createdAt, ...others } = rest;
                    return {
                        respid,
                        createdAt,
                        LastUpdate: updatedAt,
                        ...others,
                    };
                });
                setResponses(cleaned);
            })
            .catch((err) => console.error("Error fetching:", err));
    }, []);

    const downloadExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(responses);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "SurveyData");
        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        saveAs(new Blob([excelBuffer]), "SurveyData.xlsx");
    };


    if (!responses.length) return <p>No data available</p>;

    let columns = Array.from(
        new Set(responses.flatMap((row) => Object.keys(row)))
    );

    // Ensure respid, createdAt, LastUpdate come first

    const orderedStart = ["respid"];
    const orderedNext = ["createdAt", "LastUpdate"];
    columns = [
        ...orderedStart,
        ...orderedNext,
        ...columns.filter((col) => ![...orderedStart, ...orderedNext].includes(col))
    ];

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
