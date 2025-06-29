import React from 'react'
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AdminRouter from './router/index';

function App() {
  return (
    <>
    <BrowserRouter>
       <Routes>
          <Route path={"/*"} element={<AdminRouter />} />
        </Routes>
      </BrowserRouter>
     
    </>
  )
}

export default App