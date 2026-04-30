# Base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy files
COPY . /app

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose port
EXPOSE 8000

# Start command
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install "bcrypt>=4.0.1"