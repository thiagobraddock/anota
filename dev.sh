#!/bin/bash

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Iniciando PostgreSQL no Docker...${NC}"
docker-compose up -d

echo -e "${YELLOW}⏳ Aguardando PostgreSQL ficar pronto...${NC}"
sleep 5

# Verifica se postgres está saudável
docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1
while [ $? -ne 0 ]; do
  sleep 1
  docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1
done

echo -e "${GREEN}✅ PostgreSQL pronto!${NC}"
echo -e "${YELLOW}🔗 Iniciando server e client...${NC}"
echo ""

# Seta DATABASE_URL
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/notepad"

# Para postgres ao encerrar
trap "echo -e '\n${YELLOW}Parando PostgreSQL...${NC}'; docker-compose down" EXIT

# Roda dev localmente
cd /Users/thiagooliveira/developer/notepad666
npm run dev:server & npm run dev:client
wait
