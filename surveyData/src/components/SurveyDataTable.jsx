import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import "../styles/styles.css";
import { useNavigate } from "react-router-dom";

const BASE_URL = import.meta.env.VITE_BASE_URL;

const SurveyDataTable = () => {
  const [responses, setResponses] = useState([]);
  const [downloadType, setDownloadType] = useState("label"); // "label" or "coded"
  const navigate = useNavigate();

  useEffect(() => {
    axios
      .get(`${BASE_URL}/api/survey/responses`)
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

  // 🔁 Flatten function for Excel
  const flattenData = (data, type = "label") => {
    return data.map((entry) => {
      const flat = {};
      for (const key in entry) {
        const value = entry[key];
        if (
          typeof value === "object" &&
          value !== null &&
          "value" in value &&
          "label" in value
        ) {
          flat[key] = type === "coded" ? value.value : value.label;
        } else {
          flat[key] = value;
        }
      }
      return flat;
    });
  };

  const downloadExcel = () => {
    const flattened = flattenData(responses, downloadType);
    const worksheet = XLSX.utils.json_to_sheet(flattened);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SurveyData");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([excelBuffer]), `SurveyData_${downloadType}.xlsx`);
  };

  if (!responses.length) return <p>No data available</p>;

  let columns = Array.from(new Set(responses.flatMap((row) => Object.keys(row))));

  // Ensure respid, createdAt, LastUpdate come first
  const orderedStart = ["respid"];
  const orderedNext = ["createdAt", "LastUpdate"];
  columns = [
    ...orderedStart,
    ...orderedNext,
    ...columns.filter((col) => ![...orderedStart, ...orderedNext].includes(col)),
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("auth");
    navigate("/");
  };


  return (
    <div className="table-container">
      <h2 className="table-header">Survey Responses</h2>

      <div className="download-options">
        <div>
          <label htmlFor="downloadType">Download Type: </label>
          <select value={downloadType} onChange={(e) => setDownloadType(e.target.value)}>
            <option value="label">Label</option>
            <option value="coded">Coded</option>
          </select>
        </div>
        <div>
          <button className="download-btn" onClick={downloadExcel}>
            Download as Excel
          </button>&nbsp;
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
          </thead>
          <tbody>
            {responses.map((row, idx) => (
              <tr key={idx}>
                {columns.map((col) => {
                  const val = row[col];
                  if (
                    typeof val === "object" &&
                    val !== null &&
                    "value" in val &&
                    "label" in val
                  ) {
                    return (
                      <td key={col}>
                        {downloadType === "coded" ? val.value : val.label}
                      </td>
                    );
                  } else {
                    return <td key={col}>{val}</td>;
                  }
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SurveyDataTable;
