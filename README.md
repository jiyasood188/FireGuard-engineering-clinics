# Smart Fire Detection System for Industries

## Engineering Clinics Project

A team-based academic project developed as part of the Engineering Clinics course at CGC University.

The project proposes a smart fire detection system for industrial environments by combining sensor-based monitoring with webcam-based smoke-pattern analysis, backend processing, database storage, and a local alert mechanism.

## Project Overview

Industrial environments can experience rapidly developing smoke, heat, and flame conditions. This project explores a multi-source detection approach in which physical sensors and visual analysis are used together to provide a more comprehensive view of the system state.

The proposed prototype combines:

- ESP32-based sensor monitoring
- MQ-2 smoke/gas sensing
- DHT11 temperature monitoring
- Flame detection
- Laptop webcam for visual input
- OpenCV and NumPy for image processing
- TensorFlow/Keras for planned smoke-pattern analysis
- FastAPI backend
- MySQL database
- Local buzzer alert
- Browser-based interface

## Objectives

1. Detect smoke, temperature, and flame conditions using dedicated sensors.
2. Integrate physical sensor data with webcam-based smoke-pattern analysis.
3. Provide a local audible warning through a buzzer.
4. Develop a Python/FastAPI software layer for system processing and presentation.
5. Store relevant system information using MySQL.
6. Test and evaluate the prototype through controlled project demonstrations.

## System Architecture

```text
MQ-2 Sensor ─┐
DHT11 Sensor ├──> ESP32 ───> FastAPI Backend ───> MySQL
Flame Sensor ┘                    │
                                  └──> Browser Interface
                                  
Laptop Webcam
      │
      ▼
OpenCV + NumPy
      │
      ▼
TensorFlow / Keras
      │
      ▼
Smoke Pattern Analysis

Detection Condition
      │
      ▼
    Buzzer
Working Methodology
1. Sensing

The ESP32 collects readings from the MQ-2 smoke/gas sensor, DHT11 temperature sensor, and flame sensor.

2. Visual Capture

A laptop webcam captures the surrounding visual scene for smoke-pattern analysis.

3. Image Processing

OpenCV and NumPy are used for processing webcam frames and preparing visual information for analysis.

4. AI Analysis

TensorFlow/Keras is planned for smoke-pattern analysis. The exact AI model configuration will be finalized during implementation.

5. Backend Processing

FastAPI and Uvicorn provide the Python-based backend layer responsible for processing and handling system information.

6. Data Storage

Relevant system information is stored using a MySQL database.

7. Alert

A local buzzer provides an audible warning when the implemented alarm condition is met.

Technology Stack
Hardware
ESP32 DevKit
MQ-2 Smoke/Gas Sensor
DHT11 Temperature Sensor
Flame Sensor Module
Buzzer
Laptop Webcam
Breadboard and Jumper Wires
Software
Python
FastAPI
Uvicorn
OpenCV
NumPy
TensorFlow / Keras
MySQL
HTML
CSS
JavaScript
Development Tools
VS Code
Arduino IDE
Git
GitHub
Postman
Project Scope

The project focuses on developing an academic prototype for industrial fire detection using multiple sources of detection.

In Scope
ESP32-based sensor monitoring
Smoke/gas detection
Temperature monitoring
Flame detection
Webcam-based visual analysis
AI/ML-based smoke-pattern analysis
FastAPI backend
MySQL database
Browser-based presentation
Local buzzer alert
Controlled prototype demonstration
Project Boundary

This project is developed as an academic prototype and is not intended to be presented as a certified industrial fire-safety product.

It does not make production-grade emergency-control claims.

Project Status

The project is currently under development as part of the Engineering Clinics course.

The implementation focuses on integrating the sensing, visual analysis, backend, database, and alert components into a single working prototype.

Team Members
Name	Details
Jiya Sood	2510001280
Anisha	2510001275
Sunandan	Team Leader
Drishti	Team Member
Faculty Mentor

Prateek Sir

Academic Details

B.Tech. — 3rd Semester
Department of Computer Science
CGC University

Course

Engineering Clinics (EC)

Disclaimer

This project is developed for academic and demonstration purposes. It should not be used as a replacement for certified industrial fire detection or emergency safety systems.


This version is much more appropriate for a **college EC team repository** — no personal portfolio language, no unnecessary flashy stuff, and the team/course/academic context is clearly visible. It also follows the project's documented scope and prototype boundary. :contentReference[oaicite:0]{index=0}
